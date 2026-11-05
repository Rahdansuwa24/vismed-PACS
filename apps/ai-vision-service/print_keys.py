from huggingface_hub import hf_hub_download
from safetensors.torch import load_file
import os

try:
    repo_id = "Tumo505/SSL-ECG-Classification-model-card"
    print("Downloading model.safetensors...")
    file_path = hf_hub_download(repo_id, "model.safetensors")
    
    print("Loading weights...")
    weights = load_file(file_path)
    
    output_path = os.path.join(os.path.dirname(__file__), "keys.txt")
    print(f"Writing keys to {output_path}...")
    with open(output_path, "w") as f:
        for k, v in sorted(weights.items()):
            f.write(f"Key: {k} | Shape: {list(v.shape)}\n")
    print("✅ Successfully printed keys to keys.txt")
except Exception as e:
    print(f"❌ Error: {e}")
