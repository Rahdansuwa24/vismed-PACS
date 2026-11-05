import onnx
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = Path(os.getenv("VISION_MODEL_DIR", BASE_DIR.parents[1] / "models"))

target_node = "/model/Reshape_2"

for model_path in sorted(MODELS_DIR.glob("**/model.onnx")):
    try:
        model = onnx.load(str(model_path))
        found = False
        for node in model.graph.node:
            if node.name == target_node:
                found = True
                print(f"Model: {model_path.relative_to(BASE_DIR)} contains node {target_node} of type {node.op_type}")
                break
    except Exception as e:
        print(f"Error checking {model_path.name}: {e}")
