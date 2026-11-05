# Panduan Deployment & Kompilasi (.exe) ECG Forwarder

Dokumen ini berisi panduan langkah demi langkah untuk mengompilasi script Python `forwarder.py` menjadi file executable tunggal (`.exe`) dan memasangnya di PC Rumah Sakit menggunakan Windows Task Scheduler di kemudian hari.

---

## Tahap 1: Kompilasi Script menjadi File `.exe`

Lakukan langkah-langkah ini di komputer pengembang (laptop Anda) sebelum menyerahkan file ke rumah sakit.

### 1. Masuk ke Folder Proyek & Aktifkan Virtual Environment
Buka Command Prompt (CMD) atau PowerShell di folder `d:\PA\vismed\forwarder\`, lalu aktifkan environment:
```powershell
cd d:\PA\vismed\forwarder
.\venv\Scripts\activate
```

### 2. Install PyInstaller
Instal pustaka `pyinstaller` di dalam virtual environment Anda:
```powershell
pip install pyinstaller
```

### 3. Jalankan Proses Kompilasi (Compile)
Kompilasi script `forwarder.py` menjadi satu file `.exe` mandiri yang berjalan secara tersembunyi (*background/noconsole*):
```powershell
pyinstaller --onefile --noconsole forwarder.py
```

### 4. Ambil File `.exe`
Setelah proses selesai (sekitar 1-2 menit):
* Buka folder baru bernama **`dist/`** yang muncul di dalam folder proyek Anda.
* Di dalamnya, Anda akan menemukan file bernama **`forwarder.exe`**.

---

## Tahap 2: Pemasangan (Deployment) di PC Rumah Sakit

Di PC Lokal Rumah Sakit yang terhubung ke alat ECG, Anda **tidak perlu menginstal Python**. Cukup ikuti langkah berikut:

### 1. Salin File Proyek
Buat folder baru di harddisk PC rumah sakit (misalnya: `C:\VisMed-ECG\`). Salin dua file berikut dari laptop Anda ke folder tersebut:
1. 📄 **`forwarder.exe`** (ambil dari folder `dist/` hasil kompilasi tadi)
2. ⚙️ **`.env`** (file konfigurasi parameter)

### 2. Atur Variabel Lingkungan (.env)
Buka file `.env` di PC rumah sakit menggunakan **Notepad**, lalu sesuaikan path pemantauan FTP dan IP PACS VM:
```env
# Direktori FTP lokal yang dipantau
WATCH_DIR=D:\PA\EDAN\EDAN

# URL Orthanc PACS VM
ORTHANC_URL=http://10.9.23.18:8042

# URL Backend VisMed (Domain Hosting atau IP lokal backend)
BACKEND_URL=http://localhost:3000
```
*Simpan dan tutup file `.env`.*

---

## Tahap 3: Konfigurasi Auto-Start via Windows Task Scheduler

Agar program otomatis berjalan setiap kali komputer rumah sakit dinyalakan tanpa perlu ada staf yang mengeklik secara manual:

1. Buka **Task Scheduler** di Windows (klik Start, ketik `Task Scheduler`, lalu tekan Enter).
2. Di panel sebelah kanan (*Actions*), klik **Create Basic Task...**
3. **Name:** Isi dengan `VisMed ECG Forwarder Gateway`, klik *Next*.
4. **Trigger:** Pilih **When the computer starts**, klik *Next*.
5. **Action:** Pilih **Start a program**, klik *Next*.
6. **Program/script:** Klik *Browse* dan pilih file `C:\VisMed-ECG\forwarder.exe`.
7. **Start in (optional):** Ketik path foldernya: **`C:\VisMed-ECG`** *(Kolom ini Wajib diisi agar program bisa mendeteksi file .env)*. Klik *Next*.
8. Centang opsi **"Open the Properties dialog for this task when I click Finish"**, lalu klik **Finish**.
9. Pada jendela Properties yang muncul:
   * Di tab **General**: 
     * Pilih opsi **Run whether user is logged on or not** (supaya tetap jalan meski tidak ada user login).
     * Centang **Run with highest privileges**.
   * Di tab **Settings**: 
     * **Hilangkan centang** pada opsi *"Stop the task if it runs longer than (3 days)"* agar program berjalan terus selamanya.
10. Klik **OK**, lalu masukkan password Windows Anda untuk konfirmasi keamanan.

Sekarang, setiap kali PC rumah sakit dinyalakan, ECG Forwarder akan otomatis memantau folder FTP di background secara aman dan tersembunyi.
