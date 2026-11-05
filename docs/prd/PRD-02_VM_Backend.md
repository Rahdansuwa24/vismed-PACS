# PRD-02: VisMed — VM Linux Backend
### Product Requirements Document (AI Microservice & Multi-Modal Orchestrator)

**Versi:** 2.1 (Split-Backend Architecture)  
**Tanggal:** Juni 2026  
**Penulis:** Tim VisMed  
**Dokumen Terkait:** [`PRD-01_Windows_Frontend.md`](./PRD-01_Windows_Frontend.md)

---

## 1. Ringkasan Sistem
Lingkungan **VM Linux (`10.9.23.18`)** bertindak sebagai **AI Microservice Backend**. Semua *endpoint* standar (MWL, Orthanc) tetap dikelola oleh Windows. VM ini dihidupkan khusus untuk mengambil alih tugas berat: menjadi penghubung langsung (*proxy*) ke Ollama LLM agar bebas *Timeout*, dan menjalankan inferensi *Vision AI* (ONNX) untuk mendeteksi penyakit dari gambar DICOM.

---

## 2. Microservice 1: Node.js AI Backend (Port: 4000)
Ini adalah "Jembatan AI" yang menggantikan peran *chat* dari Backend Windows lama.
*   **Menerima Permintaan AI Windows:** Endpoint `/api/chat` di Windows telah dipindahkan ke mari. Saat Frontend butuh *chat* Ollama, ia langsung menembak ke port `4000` di VM ini.
*   **Integrasi RAG & Ollama:** Node.js di VM ini berkomunikasi dengan server LLM di `10.9.23.205`. Karena berada di jaringan yang sama (*low latency*), *Response Time* jauh lebih cepat dan batas *Timeout* Node.js dapat dilonggarkan tanpa mengganggu server utama Windows.
*   **Smart DICOM Router:** Mengekstrak *header* DICOM untuk mendelegasikan tugas deteksi gambar ke ONNX.

---

## 3. Microservice 2: Python ONNX Vision Service (Port: 5000)
Layanan inferensi AI lokal. Menampung berbagai jenis model medis berformat `.onnx`.

### 3.1. Routing Otomatis via DICOM Tag
Backend Node.js (Port 4000) akan membaca metadata DICOM dan merutekannya secara dinamis ke Python (Port 5000) menggunakan logika:
```python
tag = ds.BodyPartExamined  # baca dari DICOM header

# Tentukan model berdasarkan Modality + Body Part
if ds.Modality == "CT" and tag == "HEAD":
    model = load("ct/brain/model.onnx")
elif ds.Modality == "CT" and tag == "CHEST":
    model = load("ct/chest/model.onnx")
elif ds.Modality == "DX" or ds.Modality == "CR":
    model = load("xray/model.onnx")
```

---

## 4. Blueprint AI Gateway (Multi-Modalitas)
Cetak biru ekspansi model AI yang akan diintegrasikan secara bertahap ke dalam ONNX Service:

### 4.1. Daftar Lengkap Model AI per Modalitas

| Alat Medis | Modalitas | Model AI (ONNX) | Temuan yang Dideteksi |
|:---|:---|:---|:---|
| **General X-Ray** | DX / CR | DenseNet-121 / CheXNet ✅ *Terpasang* | Efusi pleura, kardiomegali, pneumonia, TBC |
| **CT Scan — Brain** | CT | ResNet-50 / EfficientNet | Perdarahan intrakranial, stroke hemoragik |
| **CT Scan — Chest** | CT | DenseNet-121 / ResNet-50 | Nodul paru, massa, efusi |
| **Mammografi** | MG | ResNet-50 / ResNeXt | Kanker payudara, kalsifikasi, BI-RADS |
| **Dental Panoramic** | DX / PX | YOLOv8 / YOLOv11 | Karies, gigi tanggal, infeksi akar |
| **USG** | US | 2D U-Net / YOLOv8-seg | Benjolan payudara, nodul tiroid (TI-RADS) |
| **Endoskopi** | ES | ResNet-50 / YOLOv8 | Polip kolon, tukak lambung |
| **ECG / EKG** | ECG | 1D CNN / 1D ResNet | Aritmia, AFib, infark miokard |

### 4.2. Status Kesiapan Model
*   **✅ Siap Pakai (Pretrained / Mudah di-export):** X-Ray (TorchXRayVision), CT Brain (RSNA 2019), Endoskopi (HyperKvasir), ECG (PTB-XL).
*   **⚠️ Perlu Fine-Tuning & Pytorch Conversion:** CT Chest (MONAI LIDC-IDRI), Mammografi (CBIS-DDSM), Dental (YOLOv8), USG. *Konversi harus dilakukan di PC dengan RAM/GPU besar, bukan di VM ini.*

### 4.3. Struktur Folder Model Final
Tujuan akhir arsitektur direktori `models/` di dalam `ai-vision-service`:
```text
models/
├── xray/
│   └── model.onnx              ✅ sudah ada
├── ct/
│   ├── brain/model.onnx        ← RSNA Hemorrhage
│   └── chest/model.onnx        ← LIDC-IDRI
├── mammography/model.onnx      ← CBIS-DDSM
├── dental/model.onnx           ← YOLOv8 Tufts
├── ultrasound/model.onnx       ← BUSI / DDTI
└── ecg/model.onnx              ← PTB-XL
```

### 4.4. Referensi Sumber Pretrained Model (HuggingFace / GitHub)

> **Catatan Penting:** Referensi di atas merupakan titik awal pengembangan. Model yang saat ini aktif digunakan hanya X-Ray (TorchXRayVision) dalam format ONNX. Model lainnya memerlukan konversi PyTorch → ONNX dan opsional *fine-tuning* sebelum dapat diintegrasikan ke dalam *pipeline*.

Daftar tautan repositori sebagai bahan pertimbangan dan titik awal pengembangan model-model di atas ke depannya:

*   **X-Ray (TorchXRayVision):** [GitHub mlmed/torchxrayvision](https://github.com/mlmed/torchxrayvision)
*   **CT Brain (RSNA):** [HuggingFace DifeiT RSNA](https://huggingface.co/DifeiT/rsna-intracranial-hemorrhage-detection) | [GitHub ResNeXt](https://github.com/arijitgupta42/RSNA-Intracranial-Hemorrhage-Detection)
*   **CT Chest (Nodul Paru):** [HuggingFace MONAI Lung Nodule](https://huggingface.co/MONAI/lung_nodule_ct_detection)
*   **Mammografi:** [HuggingFace MammoFM](https://huggingface.co/shawn24/MammoFM) | [VinDr-Mammo](https://huggingface.co/datasets/vinbigdata/vindr-mammo)
*   **Dental Panoramic:** [Roboflow YOLOv8 Dental](https://universe.roboflow.com/search?q=dental+xray) | [HuggingFace DENTEX](https://huggingface.co/datasets/ibrahimhamamci/DENTEX)
*   **USG (Ultrasound):** [HuggingFace Ultrasound Models](https://huggingface.co/models?other=ultrasound)
*   **Endoskopi:** [Dataset HyperKvasir](https://datasets.simula.no/hyper-kvasir)
*   **ECG:** [GitHub PTB-XL 1D ResNet](https://github.com/helme/ecg_ptbxl_benchmarking)
