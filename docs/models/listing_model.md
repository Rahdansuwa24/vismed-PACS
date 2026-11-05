# Catatan Riset: Daftar Model AI Vision Terpasang & Rencana Mendatang

Dokumen ini mencatat daftar lengkap model AI Vision yang saat ini aktif digunakan pada sistem PACS VisMed, serta peta jalan (blueprint) model AI yang akan diintegrasikan di masa mendatang.

---

## 1. Model AI Vision yang Sudah Terpasang (Active/Installed)

Berikut adalah model-model AI yang saat ini telah aktif di dalam **PACS ONNX Vision Service** (Port: `5000`):

| Alat Medis | Modalitas | Domain | Ukuran File (Size) | Model / Dataset Asal | Temuan / Klasifikasi | Pranala Asal (Link) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **General X-Ray** | DX / CR / PX / XA | `xray` | ~28 MB | DenseNet-121 / [TorchXRayVision](https://github.com/mlmed/torchxrayvision) | 18 label patologi dada (Atelectasis, Efusi, Kardiomegali, Pneumonia, dll.) | [GitHub torchxrayvision](https://github.com/mlmed/torchxrayvision) |
| **Tuberculosis X-Ray** | DX / CR / PX / XA | `xray_tuberculosis` | ~75 MB | ViT / [sukhmani1303/tuberculosis-vit-model](https://huggingface.co/sukhmani1303/tuberculosis-vit-model) | Klasifikasi biner aktif/tidaknya tuberkulosis (TBC) paru-paru | [HuggingFace sukhmani1303/tuberculosis-vit](https://huggingface.co/sukhmani1303/tuberculosis-vit-model) |
| **CT Scan Brain** | CT | `ct_brain` | ~344 MB <br>(1.1 MB `.onnx` + 343 MB `.data`) | ViT-Base / [RSNA 2019 Intracranial Hemorrhage](https://huggingface.co/DifeiT/rsna-intracranial-hemorrhage-detection) | Klasifikasi subtipe perdarahan otak (*Epidural, Subdural, Subarachnoid, Intraparenchymal, Intraventricular*) | [HuggingFace DifeiT RSNA](https://huggingface.co/DifeiT/rsna-intracranial-hemorrhage-detection) |
| **CT Brain Stroke Class** | CT | `ct_brain_stroke` | ~348 MB | BEiT-Base / [BTX24/beit-base-patch16-224-ft-stroke](https://huggingface.co/BTX24/beit-base-patch16-224-pt22k-ft22k-finetuned-stroke-binary) | Klasifikasi biner stroke iskemik/penyumbatan otak (Stroke vs Normal) | [HuggingFace BTX24 Stroke](https://huggingface.co/BTX24/beit-base-patch16-224-pt22k-ft22k-finetuned-stroke-binary) |
| **CT Brain Stroke Seg** | CT | `ct_brain_stroke_seg` | ~368 MB | LCNN / [hoangtung386/brain-stroke-lcnn](https://huggingface.co/hoangtung386/brain-stroke-lcnn) | Segmentasi voxel area lesi stroke iskemik (menggunakan neighbour-stacking 3 slices) | [HuggingFace hoangtung386/LCNN](https://huggingface.co/hoangtung386/brain-stroke-lcnn) |
| **CT Scan Chest** | CT | `ct_chest` | ~96 MB | CNN / [Lung Cancer CT Detection](https://huggingface.co/dorsar/lung-cancer-detection) | Klasifikasi tipe kanker paru (*Adenocarcinoma, Large Cell Carcinoma, Normal, Squamous Cell*) | [HuggingFace dorsar/lung-cancer](https://huggingface.co/dorsar/lung-cancer-detection) |
| **CT Chest Lung Nodule** | CT | `ct_chest_nodule` | ~76 MB | RetinaNet 3D / [MONAI/lung_nodule_ct_detection](https://huggingface.co/MONAI/lung_nodule_ct_detection) | Deteksi titik dan keyakinan nodul paru secara 3D (menggunakan volume-stacking 96 slices) | [HuggingFace MONAI Nodule](https://huggingface.co/MONAI/lung_nodule_ct_detection) |
| **Endoskopi** | ES | `endoscopy` | ~344 MB <br>(1.1 MB `.onnx` + 343 MB `.data`) | ViT / [HyperKvasir v2](https://datasets.simula.no/hyper-kvasir) | Klasifikasi 8 tipe kondisi gastrointestinal (Polip kolon, esophagitis, dll.) | [HuggingFace mmuratarat/kvasir-v2](https://huggingface.co/mmuratarat/kvasir-v2-classifier) |
| **ECG / EKG** | ECG / EKG | `ecg` | ~2.2 MB <br>(30.9 KB `.onnx` + 2.1 MB `.data`) | 1D CNN / [PTB-XL 12-lead ECG](https://github.com/helme/ecg_ptbxl_benchmarking) | Klasifikasi 5 superclass kardiovaskular (*NORM, MI, STTC, CD, HYP*) dari data gelombang mentah | [HuggingFace Tumo505/SSL-ECG](https://huggingface.co/Tumo505/SSL-ECG-Classification-model-card) |

---

## 2. Matriks Keandalan Patologi & Rekomendasi Model Penunjang

Berikut adalah analisis cakupan patologi dari model-model yang sudah terpasang beserta rekomendasi model penunjangnya untuk meningkatkan akurasi klinis:

### A. General X-Ray (`xray` & `xray_tuberculosis`)
*   **Keandalan Umum:** Sangat Baik (untuk skrining dada/toraks umum dan tuberkulosis aktif).
*   **Matriks Patologi:**
    *   **Pneumonia / Infiltrat / Konsolidasi:** **Sangat Baik** - Sensitif mendeteksi pola infeksi parenkim paru.
    *   **Pneumothorax / Efusi Pleura:** **Sangat Baik** - Akurat mendeteksi udara atau cairan bebas di rongga pleura.
    *   **Kardiomegali:** **Sangat Baik** - Mengukur rasio CTR (Cardiothoracic Ratio) secara visual.
    *   **TBC Aktif (Active Tuberculosis):** **Sangat Baik** - Ditangani khusus secara spesifik oleh model ViT `xray_tuberculosis`.
    *   **Nodul / Massa Paru:** **Sudah Cukup** - Sulit mendeteksi nodul sangat kecil (< 5 mm). *Rekomendasi:* Rujuk ke pemeriksaan CT Chest.
    *   **Fraktur Tulang Rusuk (Ribs):** **Kurang** - Garis patahan tulang rusuk sering tertutup bayangan organ dada. *Rekomendasi:* Gunakan model penunjang **YOLOv8 Rib Fracture Detector**.
    *   **Benda Asing (Foreign Body):** **Kurang** - *Rekomendasi Model Penunjang:* Gunakan pipeline multi-klasifikasi [shreyarchittaragi/Multi-disease-chest-x-ray-ai](https://huggingface.co/shreyarchittaragi/Multi-disease-chest-x-ray-ai).

### B. CT Scan Brain (`ct_brain` & `ct_brain_stroke` & `ct_brain_stroke_seg`)
*   **Keandalan Umum:** Sangat Baik (mencakup perdarahan intrakranial, diagnosis stroke sumbatan/iskemik, dan lokalisasi spasial lesi stroke).
*   **Matriks Patologi:**
    *   **Perdarahan Intrakranial (5 Subtipe):** **Sangat Baik** - Mengelompokkan jenis pendarahan (Epidural, Subdural, dll.) via model `ct_brain`.
    *   **Stroke Iskemik (Sumbatan/Infark):** **Sangat Baik** - Dideteksi biner secara akurat oleh `ct_brain_stroke` (BEiT) dan disegmentasikan secara spasial oleh `ct_brain_stroke_seg` (LCNN).
    *   **Tumor Otak (Massa/Kanker):** **Kurang** - Model tidak mengenali massa glioma/meningioma. *Rekomendasi Model Penunjang:* Tambahkan model segmentasi tumor [MONAI 3D U-Net BraTS](https://github.com/Project-MONAI/tutorials/blob/main/3d_segmentation/brats_segmentation_3d.ipynb).
    *   **Penyakit Degeneratif (Atrofi Otak):** **Kurang** - Tidak mengukur penyusutan otak secara kuantitatif. *Rekomendasi:* Gunakan **Brain Volume Segmentation Model**.

### C. CT Scan Chest (`ct_chest` & `ct_chest_nodule`)
*   **Keandalan Umum:** Sangat Baik (untuk klasifikasi sel kanker paru dan pelacakan nodul paru-paru kecil secara 3D).
*   **Matriks Patologi:**
    *   **Klasifikasi Tipe Kanker Paru:** **Sudah Cukup** - Mengidentifikasi tipe histologis tumor yang sudah terbentuk.
    *   **Deteksi Dini Nodul Paru (3D):** **Sangat Baik** - Menggunakan model 3D RetinaNet `ct_chest_nodule` untuk memindai seluruh volume 3D CT scan.
    *   **Infeksi Paru & Pneumonia:** **Kurang** - Tidak membedakan pola infeksi dari massa kanker. *Rekomendasi:* Integrasikan **CT Pulmonary Infection Model**.
    *   **Emboli Paru (Pulmonary Embolism):** **Kurang** - Tidak mendeteksi sumbatan pada arteri pulmonalis dengan kontras. *Rekomendasi Model Penunjang:* Gunakan model 3D CNN [RSNA PE Detection Model](https://github.com/sneddy/rsna-str-pulmonary-embolism-detection).

### D. Endoskopi (`endoscopy`)
*   **Keandalan Umum:** Sudah Cukup (baik untuk klasifikasi kondisi mukosa cerna umum, butuh lokalisasi visual).
*   **Matriks Patologi:**
    *   **Esofagitis / Ulcerative Colitis:** **Sangat Baik** - Akurat mengenali peradangan mukosa saluran cerna.
    *   **Polip Kolon (Prakanker):** **Sudah Cukup** - Mengelompokkan gambar berisi polip, tetapi tidak melokalisasi koordinat polip secara real-time. *Rekomendasi Model Penunjang:* Tambahkan model deteksi instan [YOLOv8-Polyp-Segmentation](https://github.com/vqdang/YOLOv8-Polyp-Segmentation).
    *   **Pendarahan Aktif & Ulcer:** **Kurang** - *Rekomendasi Model Penunjang:* Gunakan model ViT [mmuratarat/kvasir-v2-classifier](https://huggingface.co/mmuratarat/kvasir-v2-classifier-model-card) yang mencakup kelas tukak lambung dan pendarahan.

### E. ECG / EKG (`ecg`)
*   **Keandalan Umum:** Sangat Baik (mencakup kelainan elektrofisiologi jantung mayor dari data 12-lead).
*   **Matriks Patologi:**
    *   **Infark Miokard (Serangan Jantung):** **Sangat Baik** - Sangat sensitif terhadap elevasi/depresi segmen ST (STEMI/NSTEMI).
    *   **Blok Hantaran / Konduksi (RBBB/LBBB):** **Sangat Baik** - Akurat mendeteksi blokade hantaran kelistrikan jantung.
    *   **Hipertrofi Bilik Jantung:** **Sangat Baik** - Mendeteksi pembesaran otot jantung melalui amplitudo gelombang.
    *   **Aritmia Kompleks (A-Fib, dll.):** **Sudah Cukup** - *Rekomendasi Model Penunjang:* Gunakan model 1D CNN [MIT-BIH Arrhythmia CNN Classifier](https://github.com/MIT-BIH-ECG-Classification) untuk klasifikasi aritmia per denyut jantung.
    *   **Gangguan Elektrolit (Hiperkalemia):** **Kurang** - Perubahan gelombang T sering terlewat/dikategorikan umum. *Rekomendasi:* Gunakan model **Electrolyte ECG Estimator**.

---

## 3. Model AI Vision Rencana Mendatang (Upcoming/Planned)

Berikut adalah daftar model ekspansi yang direncanakan untuk diintegrasikan secara bertahap ke dalam ONNX Service:

| Alat Medis | Modalitas | Rencana Model AI | Target Temuan / Analisis | Pranala Referensi (Link) |
| :--- | :--- | :--- | :--- | :--- |
| **Mammografi** | MG | ResNet-50 / ResNeXt / [MammoFM](https://huggingface.co/shawn24/MammoFM) | Deteksi kanker payudara, klasifikasi kalsifikasi, penilaian BI-RADS | [HuggingFace MammoFM](https://huggingface.co/shawn24/MammoFM) \| [VinDr-Mammo](https://huggingface.co/datasets/vinbigdata/vindr-mammo) |
| **Dental Panoramic** | DX / PX | YOLOv8 / YOLOv11 | Klasifikasi karies gigi, deteksi gigi tanggal, infeksi akar | [Roboflow YOLOv8 Dental](https://universe.roboflow.com/search?q=dental+xray) \| [HuggingFace DENTEX](https://huggingface.co/datasets/ibrahimhamamci/DENTEX) |
| **USG (Ultrasound)** | US | 2D U-Net / YOLOv8-seg | Segmentasi & klasifikasi benjolan payudara, klasifikasi nodul tiroid (TI-RADS) | [HuggingFace Ultrasound Models](https://huggingface.co/models?other=ultrasound) |

---

## 4. Catatan Teknis & Status Kesiapan
* **Status Model Terpasang**: Semua 9 model di bagian **Terpasang** telah berhasil dikonversi ke format ONNX (termasuk penyesuaian custom symbolics pada model TBC), diunggah ke server VM Linux, dikonfigurasikan di router Node.js, dan diuji load serta inferensinya menggunakan `onnxruntime` secara CPU-only.
* **Status Model Mendatang**: Integrasi model mendatang memerlukan konversi dari framework asli ke format ONNX, pengaturan skema *preprocessing* dan *postprocessing* tersendiri di dalam Python AI service (`app_inference.py`), serta registrasi di middleware router Node.js.
