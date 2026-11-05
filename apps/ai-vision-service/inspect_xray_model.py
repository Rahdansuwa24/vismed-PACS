import onnx
from pathlib import Path

model_path = Path(__file__).resolve().parent / "models" / "xray" / "model.onnx"
model = onnx.load(str(model_path))

for node in model.graph.node:
    if node.name == "/model/Reshape_2":
        print("Node details:")
        print(f"  Name: {node.name}")
        print(f"  OpType: {node.op_type}")
        print(f"  Inputs: {list(node.input)}")
        print(f"  Outputs: {list(node.output)}")
        # Check initializers to find the shape input
        for init in model.graph.initializer:
            if init.name in node.input:
                import numpy as np
                # Try to unpack the initializer array
                try:
                    from onnx import numpy_helper
                    arr = numpy_helper.to_array(init)
                    print(f"  Initializer '{init.name}' value: {arr.tolist()} (shape: {arr.shape})")
                except Exception as e:
                    print(f"  Initializer '{init.name}' raw data length: {len(init.raw_data)}")
