import io
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError


BASE_DIR = Path(__file__).resolve().parent
CONFIG_DIR = BASE_DIR / "config"
MODEL_DIR = Path(os.getenv("VISION_MODEL_DIR", BASE_DIR.parent.parent / "models"))
MAX_FILES = int(os.getenv("VISION_MAX_FILES", "8"))
MAX_FILE_BYTES = int(os.getenv("VISION_MAX_FILE_BYTES", str(12 * 1024 * 1024)))
ALLOWED_DOMAINS = {
    "endoscopy",
    "xray",
    "ct_chest",
    "ct_brain",
    "ecg",
    "xray_tuberculosis",
    "ct_brain_stroke",
    "ct_brain_stroke_seg",
    "ct_chest_nodule",
}


class ModelRegistry:
    def __init__(self):
        self.models = {}

    def load(self):
        self.models = {}
        for config_path in sorted(CONFIG_DIR.glob("*.json")):
            config = json.loads(config_path.read_text(encoding="utf-8"))
            domain = config["domain"]
            model_path = MODEL_DIR / Path(config["modelPath"]).relative_to("models")
            entry = {
                "domain": domain,
                "config": config,
                "modelPath": str(model_path),
                "configured": model_path.is_file(),
                "session": None,
                "error": None,
            }
            if entry["configured"]:
                try:
                    options = ort.SessionOptions()
                    options.intra_op_num_threads = 1
                    options.inter_op_num_threads = 1
                    entry["session"] = ort.InferenceSession(
                        str(model_path),
                        sess_options=options,
                        providers=["CPUExecutionProvider"],
                    )
                except Exception as exc:
                    entry["error"] = str(exc)
            self.models[domain] = entry

    def public_status(self):
        return [
            {
                "domain": domain,
                "task": entry["config"].get("task"),
                "configured": entry["configured"],
                "loaded": entry["session"] is not None,
                "modelPath": entry["modelPath"],
                "error": entry["error"],
            }
            for domain, entry in sorted(self.models.items())
        ]


registry = ModelRegistry()


@asynccontextmanager
async def lifespan(_app):
    registry.load()
    yield


app = FastAPI(
    title="PACS ONNX Vision Service",
    version="0.1.0",
    description="Local inference service for configured endoscopy and X-ray ONNX models.",
    lifespan=lifespan,
)


def preprocess_image(image: Image.Image, config: dict) -> np.ndarray:
    input_config = config["input"]
    channels = int(input_config.get("channels", 3))
    width = int(input_config["width"])
    height = int(input_config["height"])
    preprocessing = input_config.get("preprocessing", "standard")

    if preprocessing == "tuberculosis":
        import cv2
        gray = np.asarray(image.convert("L"), dtype=np.uint8)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)
        gray = cv2.resize(gray, (width, height), interpolation=cv2.INTER_LINEAR)
        rgb = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB).astype(np.float32)
        # Z-score normalization using mean and std of this specific image
        rgb = (rgb - rgb.mean()) / (rgb.std() + 1e-8)
        array = np.transpose(rgb, (2, 0, 1))
        return np.expand_dims(array.astype(np.float32), axis=0)

    color_mode = "L" if channels == 1 else "RGB"
    image = image.convert(color_mode).resize((width, height))
    array = np.asarray(image, dtype=np.float32)

    if preprocessing == "torchxrayvision":
        if channels != 1:
            raise RuntimeError("torchxrayvision preprocessing expects a single grayscale channel")
        maxval = float(input_config.get("maxval", 255.0))
        if array.max() > maxval:
            array = np.clip(array, 0, maxval)
        array = (2 * (array / maxval) - 1.0) * 1024.0
        array = array[None, :, :]
        return np.expand_dims(array.astype(np.float32), axis=0)

    if channels == 1:
        array = array[:, :, None]

    scale = float(input_config.get("scale", 255.0))
    array = array / scale
    mean = np.asarray(input_config.get("mean", [0.0] * channels), dtype=np.float32)
    std = np.asarray(input_config.get("std", [1.0] * channels), dtype=np.float32)
    array = (array - mean) / std

    layout = input_config.get("layout", "NCHW")
    if layout == "NCHW":
        array = np.transpose(array, (2, 0, 1))
    return np.expand_dims(array, axis=0)


def sigmoid(values):
    return 1.0 / (1.0 + np.exp(-values))


def decode_classification(outputs, config: dict):
    output_config = config["output"]
    labels = output_config.get("labels", [])
    threshold = float(output_config.get("threshold", 0.5))
    activation = output_config.get("activation", "sigmoid")
    scores = np.asarray(outputs[0]).reshape(-1)

    if activation == "sigmoid":
        scores = sigmoid(scores)
    elif activation == "softmax":
        shifted = scores - np.max(scores)
        scores = np.exp(shifted) / np.sum(np.exp(shifted))

    findings = []
    for index, score in enumerate(scores):
        if float(score) >= threshold:
            findings.append({
                "label": labels[index] if index < len(labels) else f"class_{index}",
                "confidence": round(float(score), 6),
            })
    return sorted(findings, key=lambda item: item["confidence"], reverse=True)


def extract_ecg_waveform(content: bytes, filename: str) -> np.ndarray:
    # Check if JSON
    if filename.lower().endswith(".json"):
        data = json.loads(content.decode("utf-8"))
        array = np.asarray(data, dtype=np.float32)
        if array.shape != (5000, 12):
            if array.shape == (12, 5000):
                return array
            raise RuntimeError(f"JSON ECG array shape must be (5000, 12) or (12, 5000), got {array.shape}")
        return np.transpose(array)

    # Otherwise treat as DICOM Waveform
    import pydicom
    try:
        ds = pydicom.dcmread(io.BytesIO(content))
    except Exception as e:
        raise RuntimeError(f"Failed to read DICOM file: {e}")
        
    if not hasattr(ds, "WaveformSequence") or len(ds.WaveformSequence) == 0:
        raise RuntimeError("DICOM file does not contain a WaveformSequence tag")
        
    multiplex_group = ds.WaveformSequence[0]
    num_channels = int(getattr(multiplex_group, "NumberOfWaveformChannels", 12))
    num_samples = int(getattr(multiplex_group, "NumberOfWaveformSamples", 5000))
    raw_data = multiplex_group.WaveformData
    
    # Read scaling factors if present, otherwise default to 1.0 (millivolts)
    scaling_factors = []
    if hasattr(multiplex_group, "ChannelDefinitionSequence"):
        for ch_def in multiplex_group.ChannelDefinitionSequence:
            sens = float(getattr(ch_def, "ChannelSensitivity", 1.0))
            corr = float(getattr(ch_def, "ChannelSensitivityCorrectionFactor", 1.0))
            scaling_factors.append(sens * corr)
    
    # Convert binary to numpy (typically signed 16-bit)
    signal = np.frombuffer(raw_data, dtype=np.int16)
    
    expected_elements = num_samples * num_channels
    if len(signal) != expected_elements:
        if len(raw_data) == expected_elements * 4:
            signal = np.frombuffer(raw_data, dtype=np.float32)
        elif len(raw_data) == expected_elements:
            signal = np.frombuffer(raw_data, dtype=np.int8)
        else:
            raise RuntimeError(f"WaveformData size ({len(raw_data)} bytes) does not match expected size for {num_samples}x{num_channels}")
            
    signal = signal.reshape(num_samples, num_channels).astype(np.float32)
    
    # Apply scaling to convert to physical units (millivolts)
    if len(scaling_factors) == num_channels:
        for ch in range(num_channels):
            # DICOM scaling: value * sensitivity * correction_factor
            factor = scaling_factors[ch]
            signal[:, ch] = signal[:, ch] * factor
            
    # Resample or crop to exactly 5000 time steps using simple interpolation
    if num_samples != 5000:
        indices = np.linspace(0, num_samples - 1, 5000).astype(np.int32)
        signal = signal[indices, :]
        
    # Ensure exactly 12 channels
    if num_channels != 12:
        if num_channels > 12:
            signal = signal[:, :12]
        else:
            padded = np.zeros((5000, 12), dtype=np.float32)
            padded[:, :num_channels] = signal
            signal = padded
            
    # Z-score Normalization using normalisation_params.npz if available
    params_path = MODEL_DIR / "ecg" / "normalisation_params.npz"
    if params_path.is_file():
        try:
            params = np.load(params_path)
            mean = params["mean"]
            std = params["std"]
            signal = (signal - mean) / std
        except Exception:
            pass
            
    # Return shape (num_leads, signal_length) -> (12, 5000)
    return np.transpose(signal)


def decode_classification_ecg(outputs, config: dict):
    output_config = config["output"]
    labels = output_config.get("labels", [])
    activation = output_config.get("activation", "sigmoid")
    scores = np.asarray(outputs[0]).reshape(-1)

    if activation == "sigmoid":
        scores = sigmoid(scores)

    # Try to load thresholds.json
    thresholds = {}
    thresholds_path = Path(__file__).resolve().parent / "models" / "ecg" / "thresholds.json"
    if thresholds_path.is_file():
        try:
            with open(thresholds_path, "r") as f:
                thresholds = json.load(f)
        except Exception:
            pass

    findings = []
    for index, score in enumerate(scores):
        label = labels[index] if index < len(labels) else f"class_{index}"
        thresh = float(thresholds.get(label, 0.5))
        if float(score) >= thresh:
            findings.append({
                "label": label,
                "confidence": round(float(score), 6),
            })
    return sorted(findings, key=lambda item: item["confidence"], reverse=True)


def decode_classification_tuberculosis(outputs, config: dict):
    output_config = config["output"]
    threshold = float(output_config.get("threshold", 0.5))
    logit = float(np.asarray(outputs[0]).reshape(-1)[0])
    prob = sigmoid(logit)
    
    findings = []
    if prob >= threshold:
        findings.append({
            "label": "Active Tuberculosis",
            "confidence": round(float(prob), 6),
        })
    else:
        findings.append({
            "label": "Normal",
            "confidence": round(float(1.0 - prob), 6),
        })
    return findings


def decode_segmentation_stroke(outputs, config: dict):
    logits = np.asarray(outputs[0])
    # Softmax over channels (axis 1)
    exp_logits = np.exp(logits - np.max(logits, axis=1, keepdims=True))
    probs = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)
    stroke_probs = probs[0, 1] # channel 1 is stroke, shape (512, 512)
    
    max_prob = float(np.max(stroke_probs))
    threshold = float(config["output"].get("threshold", 0.5))
    stroke_pixels = int(np.sum(stroke_probs > threshold))
    
    findings = []
    if stroke_pixels > 50:
        findings.append({
            "label": "Brain Stroke",
            "confidence": round(max_prob, 6),
            "details": f"Segmented stroke area: {stroke_pixels} pixels."
        })
    else:
        findings.append({
            "label": "Normal",
            "confidence": round(1.0 - max_prob, 6),
        })
    return findings


def decode_detection_nodule(outputs, config: dict):
    # outputs: cls_p3, cls_p4, cls_p5, reg_p3, reg_p4, reg_p5
    cls_p3 = np.asarray(outputs[0])
    cls_p4 = np.asarray(outputs[1])
    cls_p5 = np.asarray(outputs[2])
    
    p3_max = sigmoid(cls_p3).max()
    p4_max = sigmoid(cls_p4).max()
    p5_max = sigmoid(cls_p5).max()
    max_prob = float(max(p3_max, p4_max, p5_max))
    
    threshold = float(config["output"].get("threshold", 0.5))
    findings = []
    if max_prob >= threshold:
        findings.append({
            "label": "Lung Nodule",
            "confidence": round(max_prob, 6),
        })
    else:
        findings.append({
            "label": "Normal",
            "confidence": round(float(1.0 - max_prob), 6),
        })
    return findings


def run_inference(entry: dict, input_data):
    session = entry["session"]
    config = entry["config"]
    domain = entry["domain"]
    if session is None:
        raise RuntimeError(entry["error"] or "Model is not loaded")

    if isinstance(input_data, np.ndarray):
        input_tensor = input_data
    elif domain == "ecg":
        # input_data is a preprocessed numpy array of shape (1000, 12)
        input_tensor = np.expand_dims(input_data, axis=0)
    else:
        input_tensor = preprocess_image(input_data, config)

    print(f"[DEBUG] Domain: {domain}, Input Tensor Shape: {input_tensor.shape}, Dtype: {input_tensor.dtype}", flush=True)

    input_name = config.get("inputName") or session.get_inputs()[0].name
    outputs = session.run(None, {input_name: input_tensor})

    task = config.get("task", "classification")
    if task == "segmentation" or domain == "ct_brain_stroke_seg":
        return decode_segmentation_stroke(outputs, config)
    elif task == "detection" or domain == "ct_chest_nodule":
        return decode_detection_nodule(outputs, config)
    elif domain == "xray_tuberculosis":
        return decode_classification_tuberculosis(outputs, config)
    elif domain == "ecg":
        return decode_classification_ecg(outputs, config)
        
    return decode_classification(outputs, config)


def apply_windowing(ds, center: float, width: float) -> np.ndarray:
    pixel_array = ds.pixel_array.astype(np.float32)
    rescale_slope = float(getattr(ds, "RescaleSlope", 1.0))
    rescale_intercept = float(getattr(ds, "RescaleIntercept", 0.0))
    hu_array = pixel_array * rescale_slope + rescale_intercept
    
    min_val = center - (width / 2.0)
    max_val = center + (width / 2.0)
    
    windowed = np.clip(hu_array, min_val, max_val)
    windowed = (windowed - min_val) / (max_val - min_val) * 255.0
    return windowed.astype(np.uint8)


def process_xray_dicom(ds) -> np.ndarray:
    from pydicom.pixel_data_handlers.util import apply_voi_lut
    try:
        pixel_array = apply_voi_lut(ds.pixel_array, ds)
    except Exception:
        pixel_array = ds.pixel_array
        
    pixel_array = pixel_array.astype(np.float32)
    min_val = np.min(pixel_array)
    max_val = np.max(pixel_array)
    if max_val > min_val:
        scaled = (pixel_array - min_val) / (max_val - min_val) * 255.0
    else:
        scaled = np.zeros_like(pixel_array)
    return scaled.astype(np.uint8)


async def read_image(upload: UploadFile, domain: str) -> Image.Image:
    content = await upload.read()
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"{upload.filename}: file exceeds size limit")
    
    is_dicom = False
    if len(content) > 132:
        if content[128:132] == b"DICM":
            is_dicom = True
            
    if is_dicom:
        import pydicom
        try:
            ds = pydicom.dcmread(io.BytesIO(content))
            if domain in ("ct_brain", "ct_brain_stroke", "ct_brain_stroke_seg"):
                pixel_array = apply_windowing(ds, center=40.0, width=80.0)
                return Image.fromarray(pixel_array).convert("RGB")
            elif domain == "ct_chest":
                pixel_array = apply_windowing(ds, center=-600.0, width=1500.0)
                return Image.fromarray(pixel_array).convert("RGB")
            elif domain == "xray":
                pixel_array = process_xray_dicom(ds)
                return Image.fromarray(pixel_array).convert("L")
            else:
                pixel_array = ds.pixel_array.astype(np.float32)
                min_val = np.min(pixel_array)
                max_val = np.max(pixel_array)
                if max_val > min_val:
                    pixel_array = (pixel_array - min_val) / (max_val - min_val) * 255.0
                return Image.fromarray(pixel_array.astype(np.uint8)).convert("RGB")
        except Exception as e:
            pass

    try:
        image = Image.open(io.BytesIO(content))
        image.load()
        return image
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=422, detail=f"{upload.filename}: unsupported image") from exc


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "onnx-vision",
        "providers": ort.get_available_providers(),
        "models": registry.public_status(),
    }


@app.get("/models")
def models():
    return {"models": registry.public_status()}


@app.post("/reload-models")
def reload_models():
    registry.load()
    return {"status": "reloaded", "models": registry.public_status()}


def verify_dicom_slice(content: bytes, domain: str) -> dict | None:
    """
    Checks if the DICOM slice matches the requested CT domain using HU heuristics.
    Returns a dict with mismatch info if a mismatch is detected, otherwise None.
    """
    if len(content) <= 132 or content[128:132] != b"DICM":
        return None  # Not a DICOM file, skip heuristic validation
        
    if domain not in ("ct_brain", "ct_brain_stroke", "ct_brain_stroke_seg", "ct_chest", "ct_chest_nodule"):
        return None  # Not a CT domain with configured checks, skip
        
    import pydicom
    import io
    import numpy as np
    
    try:
        ds = pydicom.dcmread(io.BytesIO(content), stop_before_pixels=False)
        if not hasattr(ds, "pixel_array"):
            return None
            
        pixel_array = ds.pixel_array.astype(np.float32)
        slope = float(getattr(ds, "RescaleSlope", 1.0))
        intercept = float(getattr(ds, "RescaleIntercept", 0.0))
        hu = pixel_array * slope + intercept
        
        total = hu.size
        p_lung = np.sum((hu >= -950) & (hu <= -400)) / total
        p_soft = np.sum((hu > -400) & (hu <= 100)) / total
        p_bone = np.sum(hu > 250) / total
        
        # Determine actual organ slice
        detected = "unknown"
        if p_lung >= 0.11:
            detected = "ct_chest"
        elif p_bone >= 0.045 and p_lung < 0.11:
            detected = "ct_brain"
        elif p_soft >= 0.28 and p_lung < 0.11 and p_bone < 0.045:
            detected = "ct_abdomen"
        else:
            # Fallback for high brain slices (e.g. top of the head)
            if p_bone >= 0.015 and p_lung < 0.08 and p_soft < 0.15:
                detected = "ct_brain"
                
        # Validate against requested domain group
        is_requested_brain = domain in ("ct_brain", "ct_brain_stroke", "ct_brain_stroke_seg")
        is_requested_chest = domain in ("ct_chest", "ct_chest_nodule")
        
        mismatch = False
        if is_requested_brain and detected != "ct_brain":
            mismatch = True
        elif is_requested_chest and detected != "ct_chest":
            mismatch = True
            
        if mismatch:
            readable_detected = {
                "ct_brain": "CT Brain (Otak)",
                "ct_chest": "CT Chest (Dada/Paru)",
                "ct_abdomen": "CT Abdomen (Perut)",
                "unknown": "Lain-lain / Tidak Dikenal"
            }.get(detected, detected)
            
            readable_requested = "CT Brain" if is_requested_brain else "CT Chest"
            
            return {
                "status": "domain_mismatch",
                "requested": domain,
                "detected": detected,
                "warning": f"Kritikal Mismatch: Citra terdeteksi secara visual sebagai {readable_detected}, sedangkan model AI yang diminta adalah {readable_requested}. Analisis dihentikan demi keselamatan klinis."
            }
    except Exception as e:
        # Ignore errors during verification to prevent crashing the analysis
        print(f"[VERIFY_CT_ERR] Failed to verify slice: {e}", flush=True)
        
    return None


@app.post("/analyze")
async def analyze(
    domain: Annotated[str, Form()],
    files: Annotated[list[UploadFile], File()],
    metadata: Annotated[str | None, Form()] = None,
):
    domain = domain.lower().strip()
    if domain not in ALLOWED_DOMAINS:
        raise HTTPException(status_code=422, detail=f"domain must be one of: {sorted(ALLOWED_DOMAINS)}")
    if not files or len(files) > MAX_FILES:
        raise HTTPException(status_code=422, detail=f"send between 1 and {MAX_FILES} images/frames")

    try:
        parsed_metadata = json.loads(metadata) if metadata else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="metadata must be valid JSON") from exc

    # Run visual mismatch verification on the first file
    if files:
        try:
            first_file_content = await files[0].read()
            # Seek back to 0 so other functions can read the file
            await files[0].seek(0)
            
            mismatch_info = verify_dicom_slice(first_file_content, domain)
            if mismatch_info:
                # Return 200 with status: "domain_mismatch" to Node.js backend
                return {
                    "status": "domain_mismatch",
                    "domain": domain,
                    "findings": [],
                    "analyzedFiles": [],
                    "metadata": parsed_metadata,
                    "warning": mismatch_info["warning"],
                }
        except Exception as e:
            print(f"[VERIFY_CT_ERR] Pre-read failed: {e}", flush=True)

    entry = registry.models.get(domain)
    if not entry or not entry["configured"] or not entry["session"]:
        return {
            "status": "model_not_configured",
            "domain": domain,
            "findings": [],
            "analyzedFiles": [],
            "metadata": parsed_metadata,
            "warning": f"No loaded ONNX model is configured for domain '{domain}'",
            "model": entry and registry.public_status()[list(sorted(registry.models)).index(domain)],
        }

    results = []
    if domain == "ct_chest_nodule":
        try:
            import pydicom
            import cv2
            slices = []
            for upload in files:
                content = await upload.read()
                ds = pydicom.dcmread(io.BytesIO(content))
                pixel_array = apply_windowing(ds, center=-600.0, width=1500.0)
                pixel_array = cv2.resize(pixel_array, (256, 256), interpolation=cv2.INTER_LINEAR)
                slices.append(pixel_array)
            
            N = len(slices)
            vol_np = np.stack(slices, axis=0).astype(np.float32)
            
            # Interpolate depth dimension N -> 96 slices
            indices = np.linspace(0, N - 1, 96).astype(np.int32)
            vol_96 = vol_np[indices, :, :]
            
            # Normalize to 0-1 and standardize
            vol_96 = vol_96 / 255.0
            vol_96 = (vol_96 - vol_96.mean()) / (vol_96.std() + 1e-8)
            
            # Shape should be (1, 1, H, W, D) -> (1, 1, 256, 256, 96)
            input_tensor = np.expand_dims(np.expand_dims(np.transpose(vol_96, (1, 2, 0)), axis=0), axis=0)
            
            findings = run_inference(entry, input_tensor)
            results.append({
                "filename": f"Volume of {N} slices",
                "width": 256,
                "height": 256,
                "findings": findings,
            })
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"CT Chest Nodule 3D processing failed: {str(e)}")

    elif domain == "ct_brain_stroke_seg":
        try:
            images = []
            for upload in files:
                image = await read_image(upload, domain)
                images.append(image)
            
            N = len(images)
            arrays = []
            for img in images:
                arr = np.asarray(img.convert("L").resize((512, 512)), dtype=np.float32) / 255.0
                arr = (arr - 0.2162) / 0.1841
                arrays.append(arr)
            
            for i in range(N):
                prev_slice = arrays[i - 1] if i > 0 else arrays[i]
                curr_slice = arrays[i]
                next_slice = arrays[i + 1] if i < N - 1 else arrays[i]
                
                # Stack to shape (3, 512, 512) and add batch -> (1, 3, 512, 512)
                stacked = np.stack([prev_slice, curr_slice, next_slice], axis=0)
                input_tensor = np.expand_dims(stacked, axis=0)
                
                findings = run_inference(entry, input_tensor)
                results.append({
                    "filename": files[i].filename,
                    "width": images[i].width,
                    "height": images[i].height,
                    "findings": findings,
                })
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"LCNN Stroke Segmentation processing failed: {str(e)}")

    else:
        for upload in files:
            if domain == "ecg":
                content = await upload.read()
                try:
                    signal = extract_ecg_waveform(content, upload.filename)
                    findings = run_inference(entry, signal)
                    results.append({
                        "filename": upload.filename,
                        "width": 1000,
                        "height": 12,
                        "findings": findings,
                    })
                except Exception as e:
                    raise HTTPException(status_code=422, detail=f"{upload.filename}: {str(e)}")
            else:
                image = await read_image(upload, domain)
                results.append({
                    "filename": upload.filename,
                    "width": image.width,
                    "height": image.height,
                    "findings": run_inference(entry, image),
                })

    return {
        "status": "ok",
        "domain": domain,
        "task": entry["config"].get("task"),
        "metadata": parsed_metadata,
        "analyzedFiles": results,
        "warning": "AI findings require validation by a qualified clinician.",
    }
