import os
from huggingface_hub import snapshot_download
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Folder tujuan
TARGET_DIR = r"d:\PA\vismed\vision_models"
os.makedirs(TARGET_DIR, exist_ok=True)

# Daftar model Hugging Face yang akan diunduh
models_to_download = [
    # General X-Ray: TBC Aktif
    "sukhmani1303/tuberculosis-vit-model",
]

def download_models():
    print(f"Mulai mengunduh model ke: {TARGET_DIR} ...\n")
    for repo_id in models_to_download:
        print(f"Mengunduh repositori: {repo_id}")
        try:
            snapshot_download(
                repo_id=repo_id,
                local_dir=os.path.join(TARGET_DIR, repo_id.replace("/", "_")),
                local_dir_use_symlinks=False,
                token=os.getenv("HF_TOKEN")
            )
            print(f"[BERHASIL] {repo_id}\n")
        except Exception as e:
            print(f"[GAGAL] {repo_id} - Error: {e}\n")
            
if __name__ == "__main__":
    download_models()
