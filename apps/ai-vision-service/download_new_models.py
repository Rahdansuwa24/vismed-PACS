import os
import sys
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = Path(os.getenv("VISION_MODEL_DIR", BASE_DIR.parents[1] / "models"))

def export_endoscopy():
    print("\n=== [1/2] EXPORT ENDOSCOPY MODEL (Kvasir-v2) ===")
    out_dir = MODELS_DIR / "endoscopy"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        from transformers import AutoModelForImageClassification
        import torch
        
        model_id = "mmuratarat/kvasir-v2-classifier"
        print(f"Loading model: {model_id} from HuggingFace...")
        model = AutoModelForImageClassification.from_pretrained(model_id)
        model.eval()
        
        output_path = out_dir / "model.onnx"
        print(f"Exporting model to ONNX: {output_path}...")
        dummy_input = torch.randn(1, 3, 224, 224)
        
        torch.onnx.export(
            model,
            dummy_input,
            str(output_path),
            input_names=["input"],
            output_names=["logits"],
            dynamic_axes={
                "input": {0: "batch_size"},
                "logits": {0: "batch_size"}
            },
            opset_version=14
        )
        print("✅ Endoscopy model successfully exported to ONNX.")
    except Exception as e:
        print(f"❌ Error exporting Endoscopy model: {e}")
        import traceback
        traceback.print_exc()

def export_ecg():
    print("\n=== [2/2] EXPORT ECG MODEL (PTB-XL PyTorch) ===")
    out_dir = MODELS_DIR / "ecg"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        from huggingface_hub import hf_hub_download
        from safetensors.torch import load_file
        import torch
        import torch.nn as nn
        
        model_id = "Tumo505/SSL-ECG-Classification-model-card"
        print(f"Downloading model files from: {model_id}...")
        
        weights_path = hf_hub_download(model_id, "model.safetensors")
        print("✅ model.safetensors downloaded successfully")
        
        # Define the exact 1D CNN blocks matching model.safetensors keys
        class ECGBlock(nn.Module):
            def __init__(self, in_channels, out_channels, kernel_size, padding):
                super().__init__()
                self.block = nn.Sequential(
                    nn.Conv1d(in_channels, out_channels, kernel_size=kernel_size, padding=padding, bias=False),
                    nn.BatchNorm1d(out_channels)
                )
            def forward(self, x):
                return self.block(x)
                
        # Reconstruct the model structure to match the safetensors keys
        class CustomECGModel(nn.Module):
            def __init__(self):
                super().__init__()
                self.encoder = nn.Module()
                self.encoder.features = nn.Sequential(
                    ECGBlock(12, 64, kernel_size=11, padding=5), # 0
                    ECGBlock(64, 64, kernel_size=7, padding=3),  # 1
                    ECGBlock(64, 128, kernel_size=7, padding=3), # 2
                    ECGBlock(128, 128, kernel_size=5, padding=2),# 3
                    ECGBlock(128, 256, kernel_size=5, padding=2),# 4
                    ECGBlock(256, 256, kernel_size=3, padding=1) # 5
                )
                self.head = nn.Linear(256, 5)
                
            def forward(self, x):
                for i, block in enumerate(self.encoder.features):
                    x = block(x)
                    x = torch.relu(x)
                    if i < 5:
                        x = torch.max_pool1d(x, 2)
                    else:
                        x = torch.adaptive_avg_pool1d(x, 1)
                x = x.squeeze(-1)
                return self.head(x)
                
        print("Initializing custom ECG architecture...")
        model = CustomECGModel()
        
        print("Loading safetensors weights into CustomECGModel...")
        state_dict = load_file(weights_path)
        model.load_state_dict(state_dict)
        model.eval()
        print("✅ Custom model weights loaded successfully with no mismatch!")
        
        output_path = out_dir / "model.onnx"
        print(f"Exporting PyTorch model to ONNX: {output_path}...")
        
        # Model expects shape: (batch_size, num_leads, signal_length) -> (1, 12, 5000)
        dummy_input = torch.randn(1, 12, 5000)
        
        torch.onnx.export(
            model,
            dummy_input,
            str(output_path),
            input_names=["input_values"],
            output_names=["logits"],
            dynamic_axes={
                "input_values": {0: "batch_size"},
                "logits": {0: "batch_size"}
            },
            opset_version=14
        )
        print("✅ ECG PyTorch model successfully exported to ONNX.")
    except Exception as e:
        print(f"❌ Error exporting ECG model: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    export_endoscopy()
    export_ecg()
