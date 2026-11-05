import argparse
import json
from pathlib import Path

import torch
import torchxrayvision as xrv

# Patch op_norm with a trace-friendly torch.where implementation to avoid dynamic reshape issues in ONNX
def patched_op_norm(outputs, op_threshs):
    op_threshs = op_threshs.expand(outputs.shape[0], -1)
    val_leq = outputs / (op_threshs * 2)
    val_gt = 1.0 - ((1.0 - outputs) / ((1 - op_threshs) * 2))
    return torch.where(outputs < op_threshs, val_leq, val_gt)

xrv.models.op_norm = patched_op_norm

# TorchXRayVision performs runtime input-range warnings inside forward().
# Those checks are not part of inference and break ONNX tracing/export.
xrv.utils.warn_normalization = lambda _x: None


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR.parents[1] / "models"


class SigmoidWrapper(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, x):
        # Bypassed extra sigmoid since self.model(x) already returns normalized probabilities
        return self.model(x)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", default="densenet121-res224-all")
    parser.add_argument("--opset", type=int, default=17)
    parser.add_argument("--threshold", type=float, default=0.5)
    args = parser.parse_args()

    output_path = MODEL_DIR / "xray" / "model.onnx"
    config_path = BASE_DIR / "config" / "xray.json"
    cache_dir = MODEL_DIR / "xray" / "torchxrayvision-cache"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)

    model = xrv.models.DenseNet(weights=args.weights, cache_dir=str(cache_dir))
    model.eval()
    wrapped = SigmoidWrapper(model).eval()
    dummy = torch.zeros(1, 1, 224, 224, dtype=torch.float32)

    torch.onnx.export(
        wrapped,
        dummy,
        str(output_path),
        input_names=["image"],
        output_names=["probabilities"],
        dynamic_axes={
            "image": {0: "batch"},
            "probabilities": {0: "batch"},
        },
        opset_version=args.opset,
        dynamo=False,
    )

    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["modelPath"] = "models/xray/model.onnx"
    config["inputName"] = "image"
    config["input"] = {
        "width": 224,
        "height": 224,
        "channels": 1,
        "layout": "NCHW",
        "preprocessing": "torchxrayvision",
        "maxval": 255.0,
    }
    config["output"] = {
        "activation": "identity",
        "threshold": args.threshold,
        "labels": list(model.pathologies),
    }
    config["source"] = {
        "library": "torchxrayvision",
        "weights": args.weights,
        "note": "Probabilities are sigmoid outputs from the exported wrapper.",
    }
    config_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

    print(f"Exported {output_path}")
    print(f"Updated {config_path}")
    print("Labels:", ", ".join(model.pathologies))


if __name__ == "__main__":
    main()
