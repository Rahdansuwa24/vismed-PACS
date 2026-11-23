# Panduan Deployment & Topologi Lapangan ECG Forwarder

Dokumen ini berisi panduan teknis deployment modul **VisMed ECG Forwarder** ke PC klien poliklinik/ruangan di lingkungan Rumah Sakit, mencakup topologi jaringan Skema B (1 PC per 1 Modalitas), konfigurasi IP, aturan firewall, pembuatan executable, serta konfigurasi auto-start Windows Task Scheduler.

---

## 1. Topologi Arsitektur Lapangan (Skema B: Terdistribusi)

Pada operasional rumah sakit sesungguhnya, modalitas EKG (**EDAN SE-1200 Express**) ditempatkan di beberapa ruangan (misal: Ruang Poli Jantung, IGD, ICU). Setiap alat EKG didampingi oleh 1 unit PC klien poliklinik tempat Forwarder berjalan:

```
[ Ruangan 1: Poli Jantung ]
┌───────────────────────────┐         FTP (Port 21)         ┌──────────────────────────────────────┐
│ Alat EKG EDAN SE-1200 #1  │ ────────────────────────────> │ PC Forwarder #1 (IP: 192.168.1.101)  │
│ (IP Modalitas: .51)       │                               │ STATION_NAME: RUANG_EKG_1            │
└───────────────────────────┘                               └──────────────────┬───────────────────┘
                                                                               │
[ Ruangan 2: IGD ]                                                             │
┌───────────────────────────┐         FTP (Port 21)         ┌──────────────────┼───────────────────┐
│ Alat EKG EDAN SE-1200 #2  │ ────────────────────────────> │ PC Forwarder #2 (IP: 192.168.1.102)  │
│ (IP Modalitas: .52)       │                               │ STATION_NAME: RUANG_IGD              │
└───────────────────────────┘                               └──────────────────┼───────────────────┘
                                                                               │ LAN Rumah Sakit
                                                                               │ (HTTP REST API)
                                                                               ▼
                                                            ┌──────────────────────────────────────┐
                                                            │ Server Pusat VisMed / VM Linux       │
                                                            │ (IP Server VM: 10.9.23.18)           │
                                                            │ ├─ Orthanc PACS (Port 8042)          │
                                                            │ └─ Backend Telemetri (Port 3000)     │
                                                            └──────────────────┬───────────────────┘
                                                                               │
                                                                               ▼
                                                            ┌──────────────────────────────────────┐
                                                            │ Sistem Informasi Manajemen RS (SIMRS)│
                                                            │ (Integrasi Rekam Medis Elektronik)   │
                                                            └──────────────────────────────────────┘
```

### Aturan Konfigurasi IP Jaringan:
1. **`FTP_HOST=0.0.0.0` di File `.env` (Universal):**
   * Di semua PC forwarder (PC Ruang 1, PC Ruang 2, dst.), nilai `FTP_HOST` **tetap disetel `0.0.0.0`**.
   * Nilai ini memerintahkan server FTP internal (`pyftpdlib`) untuk mendengarkan (*listen*) koneksi masuk dari semua antarmuka jaringan fisik (LAN/Wi-Fi) yang aktif pada PC tersebut.
2. **IP Statis PC Klien:**
   * Setiap PC klien wajib memiliki IP LAN statis yang unik di subnet rumah sakit (misal: `192.168.1.101`, `192.168.1.102`).
3. **Pengaturan pada Layar Modalitas EDAN:**
   * Masuk ke menu **Setup -> Transmission Setup -> Net Port**:
     * **Mode:** Net Port
     * **Server IP:** Masukkan IP PC forwarder di ruangan bersangkutan (misal di EKG Ruang 1 diisi `192.168.1.101`).
     * **Port:** 21
     * **Username:** `EDANDAT`
     * **Password:** `EDANDAT`
     * **Remote Path:** `/` (atau kosongkan)
     * **Auto Transmission:** On
4. **URL Server Pusat di File `.env`:**
   * Parameter `ORTHANC_URL` dan `BACKEND_URL` pada setiap PC forwarder harus mengarah ke **IP Server Pusat / VM**, bukan `localhost`/`127.0.0.1`:
     * `ORTHANC_URL=http://10.9.23.18:8042`
     * `BACKEND_URL=http://10.9.23.18:3000`

---

## 2. Template Konfigurasi Produksi (`.env`)

Pada setiap PC klien, buat file `.env` di folder forwarder dan sesuaikan identitas ruangannya:

```env
# ==========================================================
# KONFIGURASI FORWARDER ECG PRODUKSI (PC RUANG EKG 1)
# ==========================================================

# Embedded FTP EDAN (Dengarkan semua kartu jaringan PC ini pada port 21)
FTP_HOST=0.0.0.0
FTP_PORT=21
FTP_USERNAME=EDANDAT
FTP_PASSWORD=EDANDAT
FTP_ROOT=D:/PA/EDAN/EDAN

# Jalur Cadangan / Pengujian Manual (Folder Wajib Berbeda dari FTP_ROOT)
ENABLE_MANUAL_WATCHER=true
MANUAL_WATCH_DIR=D:/PA/EDAN/manual_incoming

# Orthanc PACS Central (Arahkan ke IP Server VM Pusat)
ORTHANC_URL=http://10.9.23.18:8042
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD=orthanc
ORTHANC_RETRIES=3

# Backend Monitoring & Telemetri Realtime
BACKEND_URL=http://10.9.23.18:3000
HEARTBEAT_SECONDS=10

# Konkurensi Pemrosesan PDF (Rendah agar hemat CPU PC Klien)
PROCESSING_WORKERS=2

# Identitas Modalitas (Wajib disesuaikan per ruangan!)
STATION_NAME=RUANG_EKG_1
DICOM_AET=VISMED_FORWARDER
DICOM_INSTITUTION_NAME=RSI_SURABAYA

# Integrasi SIMRS (Diisi sesuai kredensial service account resmi Tim IT RS)
SIMRS_CHECK_PELAYANAN_URL=http://simrs.rs-surabaya.go.id/api/pelayanan/cek
SIMRS_GET_TOKEN_URL=http://simrs.rs-surabaya.go.id/api/auth/token
SIMRS_UPLOAD_ECG_URL=http://simrs.rs-surabaya.go.id/api/rekam-medis/upload-ecg
SIMRS_AUTH_NORM=000120
SIMRS_AUTH_BIRTHDATE=1980-01-01
SIMRS_TOKEN_TTL_SECONDS=300
```

---

## 3. Konfigurasi Windows Firewall & Hak Akses Administrator

### A. Hak Akses Administrator (Port 21)
Port 21 merupakan port jaringan standar (*privileged port*). Pada sistem operasi Windows, aplikasi yang membuka *listening port* di bawah 1024 **wajib dijalankan dengan hak akses Administrator** (*Run as administrator*).

### B. Aturan Windows Firewall (Inbound Rule)
Agar koneksi FTP dari mesin EDAN tidak diblokir oleh Windows Defender Firewall:
1. Buka **Windows Defender Firewall with Advanced Security** (ketik `wf.msc` di Run).
2. Klik **Inbound Rules** -> **New Rule...**
3. Pilih **Port**, klik *Next*.
4. Pilih **TCP**, pada *Specific local ports* masukkan `21`.
5. Pilih **Allow the connection**, klik *Next*.
6. Centang profil: **Domain, Private** (hilangkan Public jika di jaringan privat rumah sakit).
7. Beri nama: `VisMed ECG Forwarder (Port 21)`.
8. *(Sangat Disarankan untuk Keamanan)*: Klik ganda aturan yang baru dibuat -> tab **Scope** -> pada bagian *Remote IP address*, pilih *These IP addresses* -> tambahkan hanya alamat IP mesin EKG terkait (misal: `192.168.1.51`).

---

## 4. Opsi Deployment di PC Klien

Terdapat dua metode untuk memasang Forwarder di PC Klien Rumah Sakit:

### Opsi 1: Portable Python + Batch Launcher (Direkomendasikan)
Metode ini paling fleksibel, mudah diperbarui jika ada penyesuaian format SIMRS, dan logging error terlihat transparan:
1. Salin seluruh isi folder `apps/forwarder` ke direktori lokal (misal `C:\VisMed-Forwarder\`).
2. Pasang Python 3.10+ di PC klien.
3. Buat virtual environment dan instal paket:
   ```cmd
   cd C:\VisMed-Forwarder
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```
4. Jalankan via `run_forwarder.bat` (yang sudah memuat logika pemanggilan Python venv).

---

### Opsi 2: Kompilasi Executable Tunggal (`.exe`) via PyInstaller
Jika PC klien tidak diizinkan memasang interpreter Python:
1. Di komputer pengembang, instal PyInstaller:
   ```cmd
   pip install pyinstaller
   ```
2. Jalankan proses *build* executable:
   ```cmd
   pyinstaller --onefile --noconsole forwarder.py
   ```
3. Ambil file `forwarder.exe` dari folder `dist/`.
4. Salin `forwarder.exe` dan file `.env` ke PC klien (misal di `C:\VisMed-Forwarder\`).

---

## 5. Konfigurasi Auto-Start via Windows Task Scheduler

Agar Forwarder otomatis aktif setiap kali PC dinyalakan tanpa perlu campur tangan operator:

1. Buka **Task Scheduler** di Windows (Run: `taskschd.msc`).
2. Di panel kanan, klik **Create Task...** (bukan Basic Task agar opsi hak akses lengkap).
3. **Tab General:**
   * **Name:** `VisMed ECG Forwarder Gateway`
   * Pilih opsi: **Run whether user is logged on or not**.
   * Centang: **Run with highest privileges** (Wajib agar bisa bind Port 21).
   * **Configure for:** Windows 10 / Windows 11.
4. **Tab Triggers:**
   * Klik *New...* -> Pada *Begin the task*, pilih **At startup**.
   * Klik *OK*.
5. **Tab Actions:**
   * Klik *New...* -> Action: **Start a program**.
   * **Program/script:**
     * Jika Opsi 1 (Batch): `C:\VisMed-Forwarder\run_forwarder.bat`
     * Jika Opsi 2 (Exe): `C:\VisMed-Forwarder\forwarder.exe`
   * **Start in (mandatory):** Isi dengan path folder: `C:\VisMed-Forwarder` *(Wajib diisi agar program dapat menemukan file .env dan file log)*.
   * Klik *OK*.
6. **Tab Conditions:**
   * Hilangkan centang *Start the task only if the computer is on AC power* (jika menggunakan laptop/PC dengan UPS).
7. **Tab Settings:**
   * **Hilangkan centang** pada *Stop the task if it runs longer than (3 days)*.
   * Centang *If the running task does not end when request, force it to stop*.
8. Klik **OK** dan masukkan kata sandi Administrator Windows.

Setelah langkah ini selesai, setiap kali PC poliklinik dinyalakan, ECG Forwarder akan otomatis mendengarkan transmisi berkas dari alat EDAN di latar belakang secara aman, kontinu, dan langsung terintegrasi ke Orthanc PACS serta SIMRS.
