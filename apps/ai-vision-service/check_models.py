import onnxruntime as ort
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = Path(os.getenv("VISION_MODEL_DIR", BASE_DIR.parents[1] / "models"))

for model_path in sorted(MODELS_DIR.glob("**/model.onnx")):
    try:
        session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        inputs = [i.name for i in session.get_inputs()]
        outputs = [o.name for o in session.get_outputs()]
        input_shapes = [i.shape for i in session.get_inputs()]
        output_shapes = [o.shape for o in session.get_outputs()]
        print(f"Model: {model_path.relative_to(BASE_DIR)}")
        print(f"  Inputs:  {inputs} with shapes {input_shapes}")
        print(f"  Outputs: {outputs} with shapes {output_shapes}\n")
    except Exception as e:
        print(f"Error loading {model_path.name}: {e}")
