import onnxruntime as ort
import numpy as np
from PIL import Image
from pathlib import Path
import json

BASE_DIR = Path("/home/pacs/servers/apps/ai-vision-service")
model_path = Path("/home/pacs/servers/models/xray/model.onnx")
config_path = BASE_DIR / "config" / "xray.json"

config = json.loads(config_path.read_text(encoding="utf-8"))

def preprocess_image(image: Image.Image, config: dict) -> np.ndarray:
    input_config = config["input"]
    channels = int(input_config.get("channels", 3))
    width = int(input_config["width"])
    height = int(input_config["height"])
    preprocessing = input_config.get("preprocessing", "standard")
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

print("Loading model...")
session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
input_name = config.get("inputName") or session.get_inputs()[0].name

print("\n--- Test 2: Real Preprocessed PNG Image ---")
try:
    img = Image.open("/home/pacs/test.png")
    input_tensor = preprocess_image(img, config)
    print("Real PNG input shape:", input_tensor.shape, "min:", input_tensor.min(), "max:", input_tensor.max())
    outputs = session.run(None, {input_name: input_tensor})
    print("Success! Output shape:", [o.shape for o in outputs])
except Exception as e:
    import traceback
    traceback.print_exc()

