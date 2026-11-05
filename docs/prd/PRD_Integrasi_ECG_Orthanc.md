# Product Requirements Document (PRD)
## Integrasi Modalitas ECG EDAN SE-1200 Express ke Orthanc PACS & SIMRS

| | |
|---|---|
| **Proyek** | VISMED |
| **Modul** | Integrasi Modalitas ECG |
| **Versi** | 1.2 |
| **Tanggal** | 20 Juni 2026 |
| **Status** | Draft |

---

## 1. Ringkasan

Dokumen ini mendefinisikan kebutuhan untuk mengalirkan hasil pemeriksaan ECG dari alat **EDAN SE-1200 Express** (Device No. 23230330006) ke dua sistem tujuan: **Orthanc PACS** dan **SIMRS** (Sistem Informasi Manajemen Rumah Sakit), sebagai bagian dari pipeline VISMED. Karena modalitas ini tidak memiliki kemampuan native DICOM networking, integrasi dilakukan melalui jalur **FTP → forwarder script → konversi gambar → Orthanc & SIMRS**.

## 2. Latar Belakang & Masalah

EDAN SE-1200 Express adalah electrocardiograph 12-channel dengan keterbatasan berikut (terkonfirmasi dari manual resmi dan pengujian langsung di unit):

- Tidak ada fungsi DICOM Storage SCU/Worklist SCU native di firmware — satu-satunya jalur transmisi adalah **FTP**, termasuk untuk file berformat DICOM.
- Fungsi format **SCP/FDA-XML/DICOM** belum aktif di unit ini (hanya DAT dan PDF tersedia); aktivasi membutuhkan password Advanced Setup dari distributor EDAN.
- Tidak ada fungsi Order/Worklist generik — hanya bisa terhubung ke software DMS milik EDAN, bukan ke server Worklist standar.
- Data pasien dalam file SCP/FDA-XML/DICOM **tidak terenkripsi** (peringatan resmi dari manual).

Selain Orthanc, hasil pemeriksaan juga perlu tersedia di **SIMRS** rumah sakit untuk keperluan rekam medis. SIMRS pada umumnya tidak memiliki viewer DICOM/waveform, sehingga membutuhkan hasil pemeriksaan dalam bentuk **gambar (JPG/PNG)** yang bisa langsung ditampilkan di rekam medis pasien — berbeda dengan Orthanc yang berperan sebagai PACS penyimpan data imaging terstruktur.

## 3. Tujuan

1. Hasil pemeriksaan ECG otomatis tersimpan di Orthanc tanpa intervensi manual setelah pemeriksaan selesai.
2. Hasil pemeriksaan ECG otomatis tersedia di SIMRS dalam format yang bisa ditampilkan langsung (gambar) di rekam medis pasien.
3. Tidak bergantung pada software DMS berbayar milik EDAN (SE-1515).
4. Proses berjalan tanpa cetak kertas (paperless capture).
5. Arsitektur cukup sederhana untuk dikelola oleh tim non-dedicated-IT (mahasiswa/mitra).

## 4. Lingkup

### Dalam lingkup
- Konfigurasi Transmission Setup & File Setup di modalitas EDAN.
- FTP receiver di PC dedicated yang LAN langsung ke modalitas.
- Script forwarder yang:
  - Mengonversi file PDF hasil pemeriksaan menjadi gambar (JPG/PNG) menggunakan library.
  - Meneruskan hasil ke Orthanc REST API.
  - Meneruskan hasil ke SIMRS API (begitu endpoint uji coba tersedia).
- Penanganan dasar: logging sukses/gagal, retry sederhana.

### Luar lingkup
- Parsing waveform ECG menjadi array numerik untuk model ONNX (modul terpisah).
- DICOM Modality Worklist (tidak didukung perangkat; pencocokan pasien dilakukan manual via Patient ID).
- Enkripsi end-to-end data pasien (dicatat sebagai risiko, bukan requirement versi ini).
- Pengembangan/spesifikasi API SIMRS itu sendiri (di luar kendali tim VISMED, menunggu pihak SIMRS).

## 5. Arsitektur Sistem

```
EDAN SE-1200 Express (ECG modality)
        │  FTP, port 21, Net Port mode (format: PDF, sementara)
        ▼
PC dedicated (Windows, LAN ke modalitas)
  ├─ FileZilla Server          → menerima file FTP
  └─ Python forwarder script
        ├─ Watch folder, deteksi file baru
        ├─ Convert PDF → image (library, misal PyMuPDF/pdf2image)
        ├─ HTTP POST → Orthanc REST API (port 8042, VM Linux)
        └─ Validasi nomor pelayanan (dari nama file)
              ├─ Cocok dengan data → HTTP POST → SIMRS API (endpoint uji coba: PENDING)
              └─ Tidak cocok → tidak dikirim, dicatat di log
```

Catatan desain:
- FTP server menggunakan **FileZilla Server standalone**, bukan XAMPP, untuk menghindari service tambahan (Apache/MySQL/Tomcat) yang tidak relevan dan rawan port conflict.
- Konversi PDF → gambar dipilih karena SIMRS umumnya tidak punya viewer DICOM/waveform; gambar adalah format paling universal untuk ditampilkan di rekam medis.
- Untuk Orthanc, gambar hasil konversi sebaiknya dibungkus sebagai DICOM Secondary Capture (bukan dikirim sebagai file gambar mentah) agar tetap tersimpan terstruktur sebagai bagian dari studi pasien — ini perlu dikonfirmasi saat implementasi forwarder.
- Pengiriman ke SIMRS digerbangi oleh validasi nomor pelayanan — gerbang ini **tidak berlaku** untuk jalur Orthanc, yang tetap menerima semua file tanpa syarat pencocokan.

### Konvensi penamaan file & aturan pencocokan

Format nama file dari modalitas: `YYYYMMDD-HHMMSS-<jenis>-<nomor_pelayanan>.pdf`

Contoh: `20260603-084917-mcu-868461.pdf`

| Segmen | Nilai pada contoh | Keterangan |
|---|---|---|
| Tanggal | `20260603` | 3 Juni 2026 |
| Waktu | `084917` | 08:49:17 |
| Jenis pemeriksaan | `mcu` | Kode jenis layanan |
| Nomor pelayanan | `868461` | Dipakai sebagai kunci pencocokan ke SIMRS |

Aturan: forwarder mengekstrak `nomor_pelayanan` dari nama file, lalu mencocokkannya dengan data pelayanan yang ada (sumber data pencocokan masih perlu dikonfirmasi — lihat Pertanyaan Terbuka).
- **Ada data yang cocok** → file dikirim ke SIMRS.
- **Tidak ada data yang cocok** → file **tidak** dikirim ke SIMRS, hanya dicatat di log sebagai "tidak terkirim — nomor pelayanan tidak ditemukan".

## 6. Kebutuhan Fungsional

| ID | Kebutuhan |
|---|---|
| F-1 | Modalitas mengirim file otomatis (Auto Transmission: On) setiap pemeriksaan selesai, tanpa perlu mencetak laporan (Print Out: Off di Record Info Setup). |
| F-2 | FTP server menerima file di folder yang dikonfigurasi, dengan kredensial sesuai setting modalitas (default EDANDAT/EDANDAT). |
| F-3 | Forwarder mendeteksi file baru di folder FTP secara real-time (event-driven, bukan polling manual). |
| F-4 | Forwarder mengonversi file PDF hasil pemeriksaan menjadi gambar (JPG/PNG) menggunakan library konversi (misal PyMuPDF/fitz atau pdf2image). |
| F-5 | Forwarder mengirim hasil gambar ke Orthanc via REST API (`POST /instances`, dibungkus DICOM Secondary Capture). |
| F-6 | Forwarder mengekstrak nomor pelayanan dari nama file (format `YYYYMMDD-HHMMSS-<jenis>-<nomor_pelayanan>.pdf`) sebelum memutuskan pengiriman ke SIMRS. |
| F-7 | Forwarder hanya mengirim gambar ke SIMRS apabila nomor pelayanan hasil ekstraksi **ditemukan kecocokannya** pada data pelayanan yang ada. |
| F-8 | Apabila nomor pelayanan **tidak ditemukan kecocokannya**, file tidak dikirim ke SIMRS dan dicatat di log sebagai tidak terkirim (bukan error/retry — ini perilaku yang disengaja). |
| F-9 | Gerbang pencocokan nomor pelayanan hanya berlaku untuk jalur SIMRS; jalur Orthanc tetap menerima semua file tanpa syarat pencocokan. |
| F-10 | Forwarder mencatat log hasil pengiriman ke masing-masing tujuan (sukses/gagal/tidak-cocok) dengan timestamp dan nama file. |
| F-11 | Sistem tetap berfungsi untuk sumber format PDF (saat ini) maupun DICOM (setelah aktivasi Advanced Setup) — konversi ke gambar dan validasi nomor pelayanan untuk SIMRS tetap berjalan terlepas dari format sumber. |

## 7. Kebutuhan Non-Fungsional

| ID | Kebutuhan |
|---|---|
| NF-1 | **Keandalan** — file yang gagal terkirim ke Orthanc atau SIMRS tidak boleh hilang; tetap tersimpan di folder lokal untuk retry. |
| NF-2 | **Keamanan** — folder FTP dan PC dedicated tidak boleh terekspos ke luar jaringan rumah sakit/lab; ikuti rekomendasi EDAN soal isolasi VLAN. |
| NF-3 | **Observability** — setiap kegagalan pengiriman (ke Orthanc maupun SIMRS) harus mudah ditelusuri dari log, termasuk tujuan mana yang gagal. |
| NF-4 | **Maintainability** — komponen FTP, konversi, dan masing-masing jalur pengiriman (Orthanc/SIMRS) independen satu sama lain; kegagalan satu jalur tidak menjatuhkan jalur lainnya. |
| NF-5 | **Latency** — file idealnya sampai di Orthanc dan SIMRS dalam hitungan detik setelah pemeriksaan selesai (bukan batch harian). |

## 8. Alur Data & Status Format

| Tahap | Format saat ini | Format target |
|---|---|---|
| Modalitas → FTP | PDF (DAT/PDF tersedia di device) | DICOM (ECG Waveform) |
| FTP → Forwarder | PDF | DICOM |
| Forwarder → Orthanc | Gambar (dibungkus DICOM Secondary Capture) | DICOM native (opsional tetap kirim gambar sebagai referensi cepat) |
| Forwarder → SIMRS | Gambar (JPG/PNG) | Gambar (JPG/PNG) — tidak berubah meski sumber jadi DICOM |

**Blocker aktif:**
1. Aktivasi format DICOM/SCP/FDA-XML menunggu password Advanced Setup dari distributor EDAN setempat.
2. Endpoint uji coba SIMRS masih **pending** dari pihak SIMRS — belum bisa dilakukan pengujian end-to-end jalur SIMRS.

## 9. Ketergantungan Eksternal

- **Distributor/teknisi EDAN** — pemberi password Advanced Setup untuk aktivasi format DICOM.
- **Tim jaringan/IT lab** — memastikan PC dedicated dapat menjangkau VM Orthanc di port 8042.
- **Pihak SIMRS** — penyedia endpoint uji coba, dokumentasi API (format request, autentikasi, dan response yang diharapkan).

## 10. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Distributor lambat merespons aktivasi DICOM | Data tetap dalam format PDF, tidak bisa diproses ONNX, hanya gambar yang terkirim | Tanyakan juga opsi SCP/FDA-XML; konversi gambar tetap berfungsi sebagai fallback ke SIMRS |
| **Endpoint uji coba SIMRS belum tersedia** | Jalur pengiriman ke SIMRS belum bisa divalidasi, integrasi tertunda | Bangun & uji jalur Orthanc lebih dulu (tidak terblokir); siapkan mock endpoint internal untuk uji forwarder sambil menunggu |
| Spesifikasi API SIMRS berubah saat endpoint resmi tersedia | Kode forwarder perlu disesuaikan ulang | Desain modul pengiriman SIMRS terpisah (decoupled) dari modul Orthanc, supaya perubahan tidak mempengaruhi jalur lain |
| PC dedicated down/restart | Pengiriman data ke kedua tujuan terhenti | Jalankan forwarder sebagai service (auto-restart), monitor folder backlog |
| Data pasien tidak terenkripsi saat transit (FTP) | Risiko kebocoran PHI | Batasi akses jaringan FTP hanya ke segmen LAN modalitas-PC; jangan expose ke jaringan luas |
| Tidak ada DICOM Worklist | Pencocokan identitas pasien manual, rawan human error | SOP input Patient ID konsisten di device, dicocokkan ulang di backend |
| Sumber data pencocokan nomor pelayanan belum jelas/terlambat sinkron | File valid gagal terkirim ke SIMRS karena dianggap "tidak cocok" (false negative) | Pastikan sumber data pencocokan (lihat Pertanyaan Terbuka) selalu terkini sebelum jam operasional; sediakan mekanisme re-check manual untuk file yang tertahan |
| Format nama file berubah di sisi modalitas/operator | Parser nomor pelayanan gagal, seluruh file dianggap tidak cocok | Validasi format nama file di awal proses, log eksplisit jika format tidak sesuai pola yang diharapkan |

## 11. Kriteria Keberhasilan (Acceptance Criteria)

1. Pemeriksaan ECG selesai → file gambar muncul di Orthanc tanpa intervensi manual.
2. Pemeriksaan ECG selesai → file gambar terkirim ke SIMRS **hanya jika** nomor pelayanan pada nama file cocok dengan data yang ada (setelah endpoint uji coba tersedia dan tervalidasi).
3. File dengan nomor pelayanan yang **tidak** cocok terbukti **tidak** terkirim ke SIMRS, dan tercatat di log dengan alasan yang jelas.
4. Tidak ada kertas tercetak selama mode pengambilan data rutin.
5. Tingkat keberhasilan pengiriman file ≥ 99% ke masing-masing tujuan dalam pengujian 1 minggu operasional.
6. Log forwarder dapat menunjukkan status setiap file yang diproses per tujuan (sukses/gagal beserta alasan).
7. Saat format DICOM aktif, transisi dari PDF ke DICOM tidak memerlukan perubahan arsitektur (hanya ganti File Format di device); jalur gambar ke SIMRS tetap berfungsi tanpa perubahan.

## 12. Pertanyaan Terbuka

- Kapan distributor EDAN dapat memberikan password Advanced Setup?
- Apakah ada biaya lisensi untuk aktivasi fitur SCP/FDA-XML/DICOM?
- Kapan endpoint uji coba SIMRS tersedia, dan siapa kontak teknis dari pihak SIMRS?
- Format request yang diharapkan SIMRS — apakah multipart/form-data, base64 JSON, atau lainnya? Apakah ada skema autentikasi (API key/token)?
- Apakah resolusi/ukuran gambar hasil konversi PDF perlu mengikuti standar tertentu dari SIMRS?
- Apakah PC dedicated akan digunakan untuk modalitas lain di masa depan (perlu desain folder/multi-device dari awal)?
- **Sumber data pencocokan nomor pelayanan** — apakah dicocokkan ke database lokal yang disinkron dari SIMRS, atau query real-time langsung ke API SIMRS?
- Apakah jenis pemeriksaan selain `mcu` (segmen ketiga di nama file) juga perlu dikirim ke SIMRS, atau hanya jenis tertentu?
- File yang tidak terkirim karena tidak ada kecocokan — apakah perlu mekanisme notifikasi/retry manual, atau cukup tercatat di log?

## 13. Referensi

- EDAN SE-12 Series Electrocardiograph User Manual (P/N 01.54.032423, Juli 2020)
- EDAN SE-1200 Series Spesifikasi Produk (EDAN USA)
- Korespondensi dengan distributor/teknisi EDAN (pending)
- Dokumentasi API SIMRS (belum tersedia — pending dari pihak SIMRS)
