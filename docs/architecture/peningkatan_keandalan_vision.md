# Catatan Riset: Peningkatan Keandalan Vision

Dokumen ini merangkum empat pilar utama MLOps Medis (*Medical Machine Learning Operations*) untuk meningkatkan akurasi dan keandalan klinis dari model-model AI yang terpasang pada VisMed PACS, lengkap dengan status implementasinya saat ini.

---

## Ringkasan Status Implementasi Pilar Keandalan

- `[ ]` **Pilar 1: Fine-Tuning (Penalaan Halus) dengan Data Lokal**
  - **Deskripsi**: Melatih ulang lapisan akhir (*transfer learning*) dari model-model vision (CNN/ViT) menggunakan dataset klinis yang telah dikonfirmasi oleh radiolog internal rumah sakit (200-500 studi kasus). Ini mengatasi kendala pergeseran karakteristik pasien lokal (*domain shift*) dan jenis mesin scanner.
  - **Langkah Tindak Lanjut**: Mengumpulkan dataset kasus terverifikasi dari PACS lokal, melakukan training ulang di lingkungan GPU PyTorch, dan mengekspor ulang model hasil latih ke file `.onnx`.
  
- `[x]` **Pilar 2: Standardisasi Preprocessing & Windowing (Hounsfield Units - HU) & Proteksi Mismatch Organ**
  - **Deskripsi**: Menghindari konversi gambar otomatis (preview standard 8-bit) yang menghilangkan data densitas organ. Sebagai gantinya, sistem mengambil data DICOM biner mentah (`.dcm`) dan menerapkan jendela visualisasi medis (*Windowing Center/Width*) yang sesuai dengan organ target:
    - **CT Chest & Chest Nodule**: Lung Window (Center: `-600.0`, Width: `1500.0` HU) untuk menonjolkan parenkim paru.
    - **CT Brain & Stroke (Class/Seg)**: Brain Window (Center: `40.0`, Width: `80.0` HU) untuk memperjelas perdarahan dan area infark/hipodensitas pada otak.
    - **General X-Ray**: Penerapan VOI LUT (*Value of Interest Look-Up Table*) standar radiografi.
  - **Proteksi Mismatch Visual (OOD)**: Menambahkan modul heuristik visual berbasis statistik nilai piksel HU pada `app_inference.py` (mendeteksi rasio volume paru `-950 s.d -400 HU`, rasio tulang tengkorak `> 250 HU`, dan rasio jaringan lunak `-400 s.d 100 HU`). Jika terdeteksi ketidaksesuaian kritis antara citra visual (misal CT Abdomen/Chest) dengan model AI yang diminta (misal CT Brain), proses inferensi akan segera dihentikan.
  - **Status**: **Sudah Diterapkan.** Backend Node.js (`index.js`) dan Python AI (`app_inference.py`) telah diintegrasikan dengan validasi silang ini. Jika terjadi mismatch, sistem akan mengembalikan status `domain_mismatch` disertai peringatan klinis khusus pada respons obrolan.
  
- `[x]` **Pilar 3: Konsensus Ensemble & Multi-Task Model (Pilihan Khusus)**
  - **Deskripsi**: Mengurangi risiko kegagalan prediksi tunggal (*blind spot*) dengan meluncurkan model-model dengan arsitektur berbeda untuk patologi yang saling melengkapi di organ yang sama (misal perdarahan otak vs stroke penyumbatan).
  - **Status**: **Sudah Diterapkan pada Otak.** Saat ini, jika modalitas CT Brain terdeteksi, sistem mendukung analisis perdarahan (`ct_brain`) sekaligus klasifikasi stroke (`ct_brain_stroke` via BEiT) dan segmentasi lesi stroke (`ct_brain_stroke_seg` via LCNN) secara dinamis berbasis metadata.

- `[ ]` **Pilar 4: Feedback Loop & Active Learning (Umpan Balik Dokter)**
  - **Deskripsi**: Mengintegrasikan tombol interaktif di Frontend UI (`[Setuju] / [Koreksi]`) agar radiolog dapat mengoreksi temuan AI yang salah. Kasus yang dikoreksi secara otomatis dipindahkan oleh backend ke direktori data training khusus untuk bahan siklus pelatihan ulang model berikutnya.
  - **Langkah Tindak Lanjut**: Menambahkan tombol feedback di Frontend (`ChatPage.jsx`) dan membuat endpoint baru `/api/ai/feedback` di backend.

---

## Pemetaan Penerapan Pilar per Model (Terpasang & Mendatang)

Tabel berikut memetakan model mana saja yang **wajib/opsional** menerapkan masing-masing pilar keandalan di atas, lengkap dengan penanda status verifikasi implementasi saat ini (`[x]` Sudah Terimplementasi, `[ ]` Belum Terimplementasi):

| Nama Model | Domain / Modalitas | Status Model | Pilar 1 (Fine-Tuning) | Pilar 2 (Windowing/Scaling) | Pilar 3 (Ensemble/Multi-Task) | Pilar 4 (Feedback Loop) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`xray`** | Foto Rontgen Dada / DX | Terpasang | `[ ] Wajib` | `[x] Wajib` (VOI LUT) | `[ ] Opsional` | `[ ] Wajib` |
| **`xray_tuberculosis`**| Skrining TBC Dada / DX | Terpasang | `[ ] Wajib` | `[x] Wajib` (Contrast CLAHE) | `[ ] Opsional` | `[ ] Wajib` |
| **`ct_brain`** | CT Kepala (Perdarahan) | Terpasang | `[ ] Wajib` | `[x] Wajib` (Brain Window HU) | `[x] Sangat Disarankan` | `[ ] Wajib` |
| **`ct_brain_stroke`** | CT Kepala (Stroke Class) | Terpasang | `[ ] Wajib` | `[x] Wajib` (Brain Window HU) | `[x] Sangat Disarankan` | `[ ] Wajib` |
| **`ct_brain_stroke_seg`**| CT Kepala (Stroke Seg) | Terpasang | `[ ] Wajib` | `[x] Wajib` (Brain Window HU) | `[x] Sangat Disarankan` | `[ ] Wajib` |
| **`ct_chest`** | CT Dada (Kanker Paru) | Terpasang | `[ ] Wajib` | `[x] Wajib` (Lung Window HU) | `[ ] Opsional` | `[ ] Wajib` |
| **`ct_chest_nodule`** | CT Dada (Nodul Paru 3D) | Terpasang | `[ ] Wajib` | `[x] Wajib` (Lung Window HU) | `[ ] Opsional` | `[ ] Wajib` |
| **`endoscopy`** | Endoskopi / ES | Terpasang | `[ ] Wajib` | `[x] Cukup Standardisasi RGB` | `[ ] Opsional` | `[ ] Wajib` |
| **`ecg`** | Sinyal Gelombang Jantung | Terpasang | `[ ] Wajib` | `[x] Wajib` (Z-Score Signal) | `[ ] Sangat Disarankan` | `[ ] Wajib` |
| **`mammography`** | CT / MG (Payudara) | Mendatang | `[ ] Wajib` | `[ ] Wajib` (Standardisasi Grayscale) | `[ ] Sangat Disarankan` | `[ ] Wajib` |
| **`dental`** | Gigi Panoramik / DX | Mendatang | `[ ] Wajib` | `[ ] Wajib` (Standardisasi Kontras) | `[ ] Opsional` | `[ ] Wajib` |
| **`ultrasound`** | USG (Payudara/Tiroid) | Mendatang | `[ ] Wajib` | `[ ] Wajib` (USG Noise Filter) | `[ ] Sangat Disarankan` | `[ ] Wajib` |

### Penjelasan Deteksi Kritis:
* **Pilar 1 (Fine-Tuning) & Pilar 4 (Feedback)**: Berlaku untuk **seluruh model** tanpa terkecuali karena AI harus terus belajar dari data lokal di rumah sakit.
* **Pilar 2 (Windowing)**: Sangat krusial untuk modalitas **CT Scan** (`ct_brain`, `ct_chest`, dan model nodul/stroke baru) karena rentang angka densitas organ (HU) sangat lebar dan tidak boleh dikonversi langsung ke 8-bit standard.
* **Pilar 3 (Ensemble/Multi-Task)**: Sangat disarankan untuk kondisi kritis/membahayakan jiwa (*life-threatening*) seperti **perdarahan & stroke otak**, **kelainan jantung (`ecg`)**, dan **kanker payudara** untuk meminimalisasi risiko lolosnya diagnosis (*False Negative*).

---

## Kemajuan Ekspansi Label Klinis (Pencapaian Integrasi Terbaru)

Sebagai bagian dari perbaikan berkesinambungan, berikut adalah kemajuan ekspansi label klinis yang sukses diintegrasikan pada siklus pembaruan terbaru:

1. **Modalitas Otak (CT Brain):**
   * **Target Tercapai:** *Acute Ischemic Stroke (Stroke Sumbatan)* kini **Aktif** didefinisikan lewat model `ct_brain_stroke` (klasifikasi biner BEiT) dan `ct_brain_stroke_seg` (segmentasi lesi LCNN).
   * **Target Roadmap Berikutnya:** *Midline Shift (Pergeseran Struktur)*, *Brain Herniation*, *Brain Tumors*, dan *Skull Fracture*.

2. **Modalitas Dada (CT Chest):**
   * **Target Tercapai:** *3D Lung Nodules (Nodul Paru)* kini **Aktif** dianalisis secara 3D dari volume data multi-slice melalui model `ct_chest_nodule` (RetinaNet 3D).
   * **Target Roadmap Berikutnya:** *Pneumonia/Bronchopneumonia*, *Pulmonary Embolism (Sumbatan Arteri)*, dan *Aortic Aneurysm/Dissection*.

3. **Modalitas Rontgen (Chest X-Ray):**
   * **Target Tercapai:** *Active Tuberculosis (TBC Aktif)* kini **Aktif** diskrining melalui model khusus ViT `xray_tuberculosis` (dengan contrast enhancement CLAHE).
   * **Target Roadmap Berikutnya:** *Pneumoperitoneum (Kebocoran Saluran Cerna)* dan *Foreign Body*.
