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

Sistem ECG Forwarder mengadopsi arsitektur **Embedded Event-Driven Gateway** berbasis Python (`apps/forwarder/forwarder.py`). Sistem ini mengeliminasi ketergantungan pada perangkat lunak pihak ketiga seperti FileZilla Server dengan mengintegrasikan server FTP internal (`pyftpdlib`) secara *in-process*.

```mermaid
flowchart TD
    subgraph Modality["1. Modalitas Fisik"]
        EDAN["EDAN SE-1200 Express<br/>(Auto Transmission via FTP Port 21)"]
    end

    subgraph ClientPC["2. PC Forwarder Ruangan (Windows Local / Client)"]
        direction TB
        FTP["Embedded FTP Server<br/>(pyftpdlib, Port 21, Host 0.0.0.0)"]
        WATCH["Fallback Manual Watcher<br/>(watchdog, Folder manual_incoming)"]
        
        HOOK["Event Trigger:<br/>on_file_received() / on_created()"]
        
        ORCH["Forwarder Orchestrator<br/>(Single Instance Mutex & ThreadPoolExecutor)"]
        
        EXTRACT["Ekstraksi Nomor Pelayanan<br/>(Format Nama File PDF)"]
        CONV["Konversi PDF -> PNG (150 DPI)<br/>(PyMuPDF / fitz)"]
        
        SIMRS_CLIENT["SIMRS Client Module<br/>(3-Stage API + Service Auth Cache)"]
        DICOM_BUILD["DICOM Secondary Capture Builder<br/>(pydicom + StationName + UID)"]
        
        FTP -->|Upload Selesai| HOOK
        WATCH -->|Copy-Paste Manual| HOOK
        HOOK --> ORCH
        ORCH --> EXTRACT
        ORCH --> CONV
        CONV --> SIMRS_CLIENT
        CONV --> DICOM_BUILD
    end

    subgraph CentralServer["3. Server Terpusat (Linux VM / Cloud)"]
        ORTHANC["Orthanc PACS Central<br/>(REST API: POST /instances Port 8042)"]
        BACKEND["Backend VisMed<br/>(Heartbeat & Telemetri Log Port 3000)"]
    end

    subgraph HospitalSIMRS["4. Sistem Eksternal RS"]
        SIMRS_API["SIMRS Rest API<br/>(Pelayanan, Auth Token, & Upload ECG)"]
    end

    DICOM_BUILD -->|HTTP POST /instances| ORTHANC
    ORCH -->|Heartbeat & Logs| BACKEND
    SIMRS_CLIENT -->|HTTP REST 3-Stage| SIMRS_API
```

### Catatan Desain Arsitektur Modern:
1. **Embedded Python FTP (`pyftpdlib`):**
   * Menggantikan FileZilla Server sepenuhnya sehingga instalasi menjadi mandiri (*self-contained*), tanpa dependensi service pihak ketiga, dan hemat memori.
   * Menggunakan *hook* `on_file_received()` yang dipanggil secara instan setelah transmisi berkas dari alat EDAN selesai 100%. Tidak lagi membutuhkan jeda buatan (`time.sleep(2)`) maupun *polling* agresif.
2. **Dual-Ingress (FTP & Fallback Manual):**
   * **Jalur Otomatis:** Berkas diunggah alat EDAN ke `FTP_ROOT` (`D:/PA/EDAN/EDAN`) via FTP port 21.
   * **Jalur Manual/Simulasi:** Berkas disalin manual ke `MANUAL_WATCH_DIR` (`D:/PA/EDAN/manual_incoming`) yang diawasi oleh pustaka `watchdog`.
   * **Isolasi Folder:** `MANUAL_WATCH_DIR` **wajib berbeda** dari `FTP_ROOT` untuk mencegah pemrosesan ganda (*race condition*).
3. **Single Instance Enforced:**
   * Memanfaatkan Windows Mutex kernel (`Local\VisMedECGForwarder`) untuk memastikan hanya satu proses forwarder yang aktif pada satu PC, mencegah bentrok port 21 atau duplikasi log.
4. **Integrasi SIMRS 3-Tahap yang Andal:**
   * **Tahap 1 (`check_pelayanan`):** Query data demografi pasien dinamis berdasarkan nomor pelayanan yang diekstrak dari nama file.
   * **Tahap 2 (`get_token`):** Autentikasi terpusat menggunakan kredensial service account resmi dengan mekanisme *memory cache* (TTL 300 detik). Hal ini menyelesaikan kendala di mana endpoint Tahap 1 tidak mengembalikan tanggal lahir pasien.
   * **Tahap 3 (`upload_ecg`):** Mengunggah citra PNG hasil konversi via *multipart/form-data* ke rekam medis pasien.
5. **Standardisasi DICOM Secondary Capture:**
   * Citra PNG dibungkus menjadi objek DICOM SC resmi menggunakan `pydicom` dengan menyematkan metadata pasien, tag institusi `(0008,0080)`, dan identitas ruangan `(0008,1010) Station Name`, lalu dikirim ke Orthanc via `POST /instances` dengan retry otomatis.

### Konvensi penamaan file & aturan pencocokan

Format nama file dari modalitas: `YYYYMMDD-HHMMSS-<jenis>-<nomor_pelayanan>.pdf`

Contoh: `20260603-084917-mcu-868461.pdf`

| Segmen | Nilai pada contoh | Keterangan |
|---|---|---|
| Tanggal | `20260603` | 3 Juni 2026 |
| Waktu | `084917` | 08:49:17 |
| Jenis pemeriksaan | `mcu` | Kode jenis layanan |
| Nomor pelayanan | `868461` | Dipakai sebagai kunci pencocokan ke SIMRS |

Aturan Pemrosesan:
1. Forwarder mengekstrak `nomor_pelayanan` dari segmen terakhir nama berkas.
2. **Jalur SIMRS (Kondisional):**
   * Jika integrasi SIMRS aktif (`simrs_enabled = True`), forwarder memanggil Tahap 1.
   * Jika data pasien valid ditemukan $\rightarrow$ forwarder melanjutkan Tahap 2 & 3 untuk mengunggah gambar ke SIMRS.
   * Jika data tidak ditemukan / format tidak cocok $\rightarrow$ upload SIMRS dilewati dengan aman (*graceful skip*) dan dicatat di log.
3. **Jalur Orthanc PACS (Universal):**
   * Tetap memproses seluruh berkas tanpa syarat kecocokan SIMRS. Jika data pasien dari SIMRS tersedia, metadata tersebut disematkan ke dalam tag DICOM; jika tidak, tag DICOM diisi dengan data default/nomor pelayanan yang terbaca dari nama file.

## 6. Kebutuhan Fungsional

| ID | Kebutuhan |
|---|---|
| F-1 | Modalitas mengirim file otomatis (Auto Transmission: On) setiap pemeriksaan selesai, tanpa perlu mencetak laporan (Print Out: Off di Record Info Setup). |
| F-2 | Embedded FTP server (`pyftpdlib`) menerima file di `FTP_ROOT` yang dikonfigurasi, mendengarkan di `FTP_HOST=0.0.0.0` Port 21 dengan kredensial alat (default `EDANDAT/EDANDAT`). |
| F-3 | Forwarder mendeteksi penyelesaian transfer file secara event-driven via hook `on_file_received` tanpa delay manual. |
| F-4 | Fallback watcher (`watchdog`) memantau folder manual terpisah (`MANUAL_WATCH_DIR`) untuk pengujian simulasi atau penyalinan file darurat. |
| F-5 | Forwarder mengonversi halaman 1 berkas PDF menjadi citra PNG resolusi tinggi (150 DPI) di dalam memori menggunakan PyMuPDF (`fitz`). |
| F-6 | Forwarder mengekstrak nomor pelayanan dari nama file (format `YYYYMMDD-HHMMSS-<jenis>-<nomor_pelayanan>.pdf`). |
| F-7 | Forwarder melakukan kueri data pasien ke endpoint SIMRS Tahap 1 (`check_pelayanan`) menggunakan nomor pelayanan tersebut. |
| F-8 | Forwarder mengotentikasi akun service resmi ke endpoint SIMRS Tahap 2 (`get_token`) dengan *in-memory token caching* (TTL 300 detik) untuk mengunggah citra ECG ke SIMRS Tahap 3 (`upload_ecg`). |
| F-9 | Forwarder membungkus citra PNG menjadi berkas DICOM Secondary Capture (`pydicom`) dengan UID unik, metadata pasien, serta DICOM Station Name sesuai identitas ruangan. |
| F-10 | Forwarder mengirim berkas DICOM ke Orthanc PACS REST API (`POST /instances`) dengan mekanisme *auto-retry* hingga 3 kali. |
| F-11 | Forwarder mengirim sinyal *heartbeat* berkala dan telemetri log audit aktivitas ke Backend VisMed (`POST /pacs/ecg-heartbeat` & `POST /pacs/ecg-log`). |
| F-12 | Single-instance lock menggunakan Windows Mutex mencegah bentrok jalannya dua program forwarder secara bersamaan di PC yang sama. |

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

**Status Implementasi & Integrasi:**
1. **Aktivasi format DICOM/SCP/FDA-XML di modalitas:** Menunggu password Advanced Setup distributor EDAN. Sebagai solusinya, sistem saat ini stabil menggunakan transmisi PDF yang dikonversi ke DICOM Secondary Capture.
2. **Integrasi SIMRS:** Pipeline 3-tahap telah diimplementasikan dengan aman menggunakan *Service-Account token caching*, memungkinkan pengunggahan data rekam medis pasien mana pun secara dinamis.

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
