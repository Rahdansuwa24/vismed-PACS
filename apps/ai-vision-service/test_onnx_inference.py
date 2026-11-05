import onnxruntime as ort
import numpy as np
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = Path(os.getenv("VISION_MODEL_DIR", BASE_DIR.parents[1] / "models"))

models = {
    "ct_brain": {"path": "ct_brain/model.onnx", "input_shape": (1, 3, 224, 224), "input_name": "input"},
    "ct_chest": {"path": "ct_chest/model.onnx", "input_shape": (1, 3, 224, 224), "input_name": "input"},
    "ecg": {"path": "ecg/model.onnx", "input_shape": (1, 12, 5000), "input_name": "input_values"},
    "endoscopy": {"path": "endoscopy/model.onnx", "input_shape": (1, 3, 224, 224), "input_name": "input"},
    "xray": {"path": "xray/model.onnx", "input_shape": (1, 1, 224, 224), "input_name": "image"},
}

for name, info in models.items():
    model_path = MODELS_DIR / info["path"]
    if not model_path.exists():
        print(f"{name}: File not found")
        continue
    try:
        session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        dummy_input = np.random.randn(*info["input_shape"]).astype(np.float32)
        outputs = session.run(None, {info["input_name"]: dummy_input})
        print(f"✅ {name}: Success! Output shapes: {[o.shape for o in outputs]}")
    except Exception as e:
        print(f"❌ {name}: Failed! Error: {e}")
