#!/bin/bash
# Script untuk mengunduh dan menginstal model CT Chest & CT Brain
# Jalankan di VM: bash /home/pacs/servers/apps/ai-vision-service/download_ct_models.sh

set -e
APP_DIR=/home/pacs/servers/apps/ai-vision-service
MODEL_DIR=/home/pacs/servers/models
VENV_DIR=/home/pacs/servers/runtime/venvs/ai-vision-service
cd "$APP_DIR"

echo "============================================"
echo "  INSTALASI MODEL CT CHEST & CT BRAIN"
echo "============================================"

# === 1. CT CHEST ===
echo ""
echo "[1/4] Mengunduh model CT Chest (dorsar/lung-cancer-detection)..."
mkdir -p "$MODEL_DIR/ct_chest"

# Download ONNX langsung dari HuggingFace
curl -L -o "$MODEL_DIR/ct_chest/model.onnx" \
  "https://huggingface.co/dorsar/lung-cancer-detection/resolve/main/Model/lung_cancer_detection_model.onnx" \
  2>&1

if [ -f "$MODEL_DIR/ct_chest/model.onnx" ] && [ $(wc -c < "$MODEL_DIR/ct_chest/model.onnx") -gt 1000 ]; then
  SIZE=$(du -h "$MODEL_DIR/ct_chest/model.onnx" | cut -f1)
  echo "✅ CT Chest model berhasil diunduh ($SIZE)"
else
  echo "❌ Gagal mengunduh CT Chest model. File tidak ada atau korup."
  exit 1
fi

# === 2. CT BRAIN ===
echo ""
echo "[2/4] Menyiapkan konversi model CT Brain..."
mkdir -p "$MODEL_DIR/ct_brain"

# Cek apakah transformers sudah terinstall
if ! "$VENV_DIR/bin/python3" -c "import transformers" 2>/dev/null; then
  echo "Menginstall transformers & torch (diperlukan untuk konversi)..."
  "$VENV_DIR/bin/pip" install --no-cache-dir transformers torch safetensors 2>&1 | tail -5
fi

echo "[3/4] Mengunduh & mengkonversi CT Brain model ke ONNX..."
MODEL_DIR="$MODEL_DIR" "$VENV_DIR/bin/python3" - << 'PYEOF'
import sys
import os

os.chdir("/home/pacs/servers/apps/ai-vision-service")

print("Mengunduh model DifeiT/rsna-intracranial-hemorrhage-detection dari HuggingFace...")
try:
    from transformers import ViTForImageClassification
    import torch

    model = ViTForImageClassification.from_pretrained(
        "DifeiT/rsna-intracranial-hemorrhage-detection"
    )
    model.eval()

    # Cek label mapping dari model
    print(f"Label mapping: {model.config.id2label}")
    print(f"Jumlah kelas: {model.config.num_labels}")

    # Export ke ONNX
    dummy_input = torch.randn(1, 3, 224, 224)
    output_path = os.path.join(os.environ["MODEL_DIR"], "ct_brain", "model.onnx")

    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "logits": {0: "batch_size"}
        },
        opset_version=14
    )

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"✅ CT Brain model berhasil diekspor ke ONNX ({size_mb:.1f} MB)")

    # Verifikasi dengan onnxruntime
    import onnxruntime as ort
    import numpy as np

    session = ort.InferenceSession(output_path, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    print(f"   ONNX input name: '{input_name}', output name: '{output_name}'")
    print(f"   ONNX input shape: {session.get_inputs()[0].shape}")

    # Test inference
    test_input = np.random.randn(1, 3, 224, 224).astype(np.float32)
    result = session.run(None, {input_name: test_input})
    print(f"   Test output shape: {result[0].shape}")
    print(f"   Test output (logits): {result[0][0][:3]}...")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
PYEOF

# === 3. RELOAD SERVICE ===
echo ""
echo "[4/4] Reloading ONNX Vision Service..."
curl -s -X POST http://localhost:5000/reload-models | python3 -m json.tool 2>/dev/null || echo "(service mungkin perlu restart manual)"

echo ""
echo "============================================"
echo "  Cek status akhir:"
echo "============================================"
curl -s http://localhost:5000/health | python3 -m json.tool 2>/dev/null || echo "(health check gagal)"

echo ""
echo "SELESAI!"
