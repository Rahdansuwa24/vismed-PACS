# Panduan Menjalankan & Integrasi Lingkungan Tunggal (Unified VM Environment)

Dokumen ini menjelaskan konfigurasi dan cara menjalankan seluruh komponen **VisMed PACS & AI Gateway** di dalam satu lingkungan VM Linux (`10.9.23.18`), setelah penggabungan dari arsitektur terpisah (split-environment).

---

## 1. Topologi Layanan & Port di Server VM

Semua microservice berjalan secara lokal di dalam VM dan saling terhubung melalui loopback network (`127.0.0.1`):

| Layanan | Direktori | Port | Fungsi Utama |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | `apps/frontend` | `5173` | UI Dokter (DICOM Viewer, Chatbot, Worklist, ECG Monitor) |
| **Backend VisMed** | `apps/backend-vismed` | `3000` | AI Chatbot / MedGemma Controller, MWL, & Patient View |
| **DICOM Router & Decode**| `apps/dicom-gateway` | `4000` | Extractor DICOM context, video conversion, MCP, & Ollama Proxy |
| **AI Vision Service** | `apps/ai-vision-service` | `5000` | FastAPI ONNX Model Inference (9 Model Klinis) |
| **Orthanc PACS** | System Service | `8042` | Server DICOM & OHIF Web Viewer (`/ohif/viewer`) |
| **Ollama LLM** | Host Jaringan Lokal | `10.9.23.205:11434` | Model `medgemma:4b` |
| **ECG Forwarder** | `apps/forwarder` | Background | Monitor folder FTP, convert PDF -> DICOM/SIMRS |

---

## 2. Struktur Konfigurasi Environment (`.env`)

### A. DICOM Gateway (`apps/dicom-gateway/.env`)
Digunakan oleh `app.js` (Port 4000):
```env
PORT=4000
ORTHANC_URL=http://127.0.0.1:8042
ORTHANC_USER=orthanc
ORTHANC_PASS=orthanc
AI_CHATBOT_URL=http://127.0.0.1:3000/ai/chatbot
DECODE_DICOM_PYTHON=/home/pacs/servers/runtime/venvs/dicom-gateway-convert/bin/python
DICOM_MCP_COMMAND=/home/pacs/.local/bin/uv
DICOM_MCP_ARGS=run dicom-mcp configuration.yaml --transport stdio
DICOM_MCP_CWD=/home/pacs/dicom-mcp/dicom-mcp
```

### B. Backend VisMed (`apps/backend-vismed/.env`)
Digunakan oleh `backend-vismed` (Port 3000):
```env
PORT=3000
PACS_URL=http://10.9.23.18
OHIF_VIEWER_URL=http://10.9.23.18/ohif/viewer
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD=orthanc
NODE_ENV=development
REQUEST_BODY_LIMIT=50mb

# Internal VM connections
ENDPOINT=http://127.0.0.1:4000/api
DICOM_EXTRACTOR_URL=http://127.0.0.1:4000/api/decode-dicom
DICOM_ANALYSIS_URL=http://127.0.0.1:4000/api/decode-dicom/study-analysis
VISMED_AI_URL=http://127.0.0.1:3000/ai/dicom-analysis
ORTHANC_URL=http://127.0.0.1:8042

# Ollama & MCP
OLLAMA_HOST=http://127.0.0.1:4000/api/ollama
OLLAMA_MODEL=medgemma:4b
OLLAMA_TIMEOUT_MS=120000
OLLAMA_NUM_PREDICT=1024
DICOM_BRIDGE_URL=http://127.0.0.1:4000/dicom-mcp
DICOM_CONTEXT_ENABLED=true
DICOM_FAST_SUMMARY_ENABLED=false
DICOM_CONTEXT_MAX_STUDIES=3
```

### C. AI Vision Service (`apps/ai-vision-service/.env`)
```env
VISION_MAX_FILES=8
VISION_MAX_FILE_BYTES=12582912
VISION_MODEL_DIR=/home/pacs/servers/models
```

### D. ECG Forwarder (`apps/forwarder/.env`)
```env
WATCH_DIR=/home/pacs/servers/data/ftp_incoming
ORTHANC_URL=http://127.0.0.1:8042
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD=orthanc
BACKEND_URL=http://127.0.0.1:3000
STATION_NAME=RUANG_EKG_1
DICOM_AET=VISMED_FORWARDER
DICOM_INSTITUTION_NAME=RSI_SURABAYA
```

---

## 3. Langkah-Langkah Menjalankan Seluruh Sistem di VM

Buka sesi terminal di server VM `/home/pacs/servers/` (atau jalankan via `systemd` / `pm2` / `tmux`):

### 1. Jalankan AI Vision Service (Port 5000)
```bash
cd /home/pacs/servers/apps/ai-vision-service
VISION_MODEL_DIR=/home/pacs/servers/models \
  /home/pacs/servers/runtime/venvs/ai-vision-service/bin/uvicorn app_inference:app --host 127.0.0.1 --port 5000 --workers 1
```

### 2. Jalankan Root DICOM Gateway (Port 4000)
```bash
cd /home/pacs/servers/apps/dicom-gateway
npm install
npm start   # menjalankan node app.js (port 4000)
```

### 3. Jalankan VisMed Backend (Port 3000)
```bash
cd /home/pacs/servers/apps/backend-vismed
npm install
npm start   # menjalankan ./bin/www (port 3000)
```

### 4. Jalankan Frontend UI (Port 5173)
```bash
cd /home/pacs/servers/apps/frontend
npm install
npm run dev -- --host 0.0.0.0   # agar dapat diakses dari browser jaringan
```

### 5. Jalankan ECG Forwarder (Opsional / Background)
```bash
cd /home/pacs/servers/apps/forwarder
python3 forwarder.py
```

---

## 4. Model AI Vision yang Terpasang
Untuk mengunduh kembali model jika belum tersedia di folder `models/`:
1. `python download_new_models.py` (Endoskopi & ECG)
2. `bash download_ct_models.sh` (CT Brain & Chest)

---

## 5. Ilustrasi Penyusunan Ulang Folder untuk Satu VM

Karena frontend, backend, DICOM gateway, AI vision service, dan forwarder sekarang berada dalam satu environment VM, struktur folder sebaiknya dibuat berdasarkan peran service, bukan lagi berdasarkan asal environment Windows/VM lama.

Rekomendasi target:

```text
/home/pacs/servers/
├─ apps/
│  ├─ frontend/                 # React/Vite UI dokter dan operator
│  ├─ backend-vismed/           # Express API utama: chatbot, MWL, patient view
│  ├─ dicom-gateway/            # Express gateway: decode DICOM, MCP, conversion, Ollama proxy
│  ├─ ai-vision-service/        # FastAPI/ONNX inference service
│  └─ forwarder/                # ECG/DICOM forwarder background worker
│
├─ docs/
│  ├─ architecture/
│  ├─ deployment/
│  ├─ installation/
│  ├─ models/
│  └─ prd/
│
├─ data/
│  ├─ ftp_incoming/             # folder input ECG/PDF/DICOM lokal
│  ├─ samples/                  # contoh file uji
│  └─ videos/                   # file video/DICOM conversion sample
│
├─ models/
│  ├─ xray/
│  ├─ ct_brain/
│  ├─ ct_chest/
│  ├─ ecg/
│  └─ endoscopy/
│
├─ infra/
│  ├─ docker/
│  │  ├─ docker-compose.yml
│  │  ├─ frontend.Dockerfile
│  │  ├─ backend-vismed.Dockerfile
│  │  ├─ dicom-gateway.Dockerfile
│  │  └─ ai-vision-service.Dockerfile
│  ├─ nginx/
│  └─ systemd/
│
├─ scripts/
│  ├─ dicom/
│  ├─ models/
│  └─ deployment/
│
├─ .env.example
└─ README.md
```

Catatan untuk dua service Node:

| Service | Status Saat Ini | Peran Setelah Disatukan |
| :--- | :--- | :--- |
| Root Node (`app.js`, port `4000`) | Dulu menjadi service VM terpisah | Tetap dipertahankan sebagai `dicom-gateway`, khusus routing DICOM, decode, MCP, conversion, dan proxy AI/Ollama |
| `backend-vismed` (port `3000`) | Dulu berpasangan dengan frontend/Windows | Tetap dipertahankan sebagai `apps/backend-vismed`, API bisnis utama untuk frontend |

Jadi, dua Node service tidak perlu langsung digabung menjadi satu codebase. Yang perlu dirapikan adalah penamaan dan batas tanggung jawabnya agar tidak terlihat seperti duplikasi backend.

---

## 6. Rencana Implementasi Docker di Unified VM

Docker sebaiknya diterapkan bertahap. Target akhirnya adalah semua service aplikasi berjalan sebagai container, sementara data medis, model ONNX, dan konfigurasi sensitif tetap berada di volume/folder host VM.

### 6.1. Prinsip Containerisasi

- Satu container untuk satu service utama.
- Jangan memasukkan `.env`, model besar, file DICOM, atau data pasien ke image Docker.
- Gunakan Docker volume/bind mount untuk `models/`, `data/`, dan konfigurasi runtime.
- Gunakan network internal Docker agar service saling memanggil lewat nama service, bukan `127.0.0.1`.
- Expose ke jaringan rumah sakit hanya port yang diperlukan: frontend/reverse proxy, backend publik jika perlu, dan Orthanc/OHIF sesuai kebijakan.

### 6.2. Mapping Service ke Container

| Container | Source | Internal Port | Catatan |
| :--- | :--- | :--- | :--- |
| `frontend` | `apps/frontend` | `5173` atau build static via Nginx | Untuk production lebih baik build static dan serve via Nginx |
| `backend-vismed` | `apps/backend-vismed` | `3000` | API utama frontend |
| `dicom-gateway` | `apps/dicom-gateway` | `4000` | Decode DICOM, conversion, MCP, dan proxy Ollama |
| `ai-vision-service` | `apps/ai-vision-service` | `5000` | FastAPI inference ONNX |
| `orthanc` | image resmi Orthanc atau service host existing | `8042` | Bisa tetap host service dulu jika migrasi Orthanc belum siap |
| `forwarder` | `apps/forwarder` | background | Mount folder input ECG/PDF/DICOM |

### 6.3. Perubahan Environment Saat Masuk Docker

Jika service berada dalam satu `docker-compose.yml`, endpoint internal tidak lagi memakai `127.0.0.1`. Gunakan nama service:

```env
# backend-vismed
ENDPOINT=http://dicom-gateway:4000/api
DICOM_EXTRACTOR_URL=http://dicom-gateway:4000/api/decode-dicom
DICOM_ANALYSIS_URL=http://dicom-gateway:4000/api/decode-dicom/study-analysis
ORTHANC_URL=http://orthanc:8042
OLLAMA_HOST=http://dicom-gateway:4000/api/ollama

# dicom-gateway
AI_CHATBOT_URL=http://backend-vismed:3000/ai/chatbot
ORTHANC_URL=http://orthanc:8042
VISION_SERVICE_URL=http://ai-vision-service:5000

# forwarder
BACKEND_URL=http://backend-vismed:3000
ORTHANC_URL=http://orthanc:8042
WATCH_DIR=/data/ftp_incoming
```

Jika Orthanc dan Ollama masih berjalan di host VM atau host jaringan lain, gunakan alamat host/jaringan yang stabil, misalnya `http://10.9.23.18:8042` untuk Orthanc host atau `http://10.9.23.205:11434` untuk Ollama.

### 6.4. Contoh `docker-compose.yml` Awal

Contoh ini adalah blueprint implementasi, bukan file final. Sesuaikan path setelah folder benar-benar dirapikan.

```yaml
services:
  frontend:
    build:
      context: ../../apps/frontend
      dockerfile: ../../infra/docker/frontend.Dockerfile
    ports:
      - "5173:5173"
    environment:
      VITE_API_BASE_URL: http://10.9.23.18:3000
    depends_on:
      - backend-vismed

  backend-vismed:
    build:
      context: ../../apps/backend-vismed
      dockerfile: ../../infra/docker/backend-vismed.Dockerfile
    env_file:
      - ../../apps/backend-vismed/.env
    ports:
      - "3000:3000"
    depends_on:
      - dicom-gateway

  dicom-gateway:
    build:
      context: ../../apps/dicom-gateway
      dockerfile: ../../infra/docker/dicom-gateway.Dockerfile
    env_file:
      - ../../apps/dicom-gateway/.env
    ports:
      - "4000:4000"
    volumes:
      - ../../data:/data
    depends_on:
      - ai-vision-service

  ai-vision-service:
    build:
      context: ../../apps/ai-vision-service
      dockerfile: ../../infra/docker/ai-vision-service.Dockerfile
    env_file:
      - ../../apps/ai-vision-service/.env
    environment:
      VISION_MODEL_DIR: /models
    ports:
      - "5000:5000"
    volumes:
      - ../../models:/models:ro

  forwarder:
    build:
      context: ../../apps/forwarder
      dockerfile: ../../infra/docker/forwarder.Dockerfile
    env_file:
      - ../../apps/forwarder/.env
    volumes:
      - ../../data/ftp_incoming:/data/ftp_incoming
    depends_on:
      - backend-vismed
      - dicom-gateway
```

### 6.5. Urutan Implementasi yang Disarankan

1. Rapikan folder dokumentasi dan tetapkan struktur target tanpa memindahkan kode produksi terlebih dahulu.
2. Tambahkan `.dockerignore` di tiap service agar `node_modules/`, `venv/`, `.env`, cache, dan file medis tidak ikut masuk image.
3. Buat Dockerfile untuk `backend-vismed` dan `dicom-gateway` terlebih dahulu karena keduanya Node.js dan paling mudah distandarkan.
4. Buat Dockerfile `ai-vision-service` dengan base image Python yang sesuai, lalu mount model ONNX dari host.
5. Jalankan `docker compose up backend-vismed dicom-gateway ai-vision-service` di staging VM.
6. Setelah API stabil, containerize frontend. Untuk production, build frontend menjadi static files dan serve lewat Nginx.
7. Containerize forwarder terakhir karena ia bergantung pada folder input lokal dan workflow alat ECG.
8. Migrasikan Orthanc ke Docker hanya jika backup, storage DICOM, dan konfigurasi OHIF sudah jelas.
9. Setelah semua service stabil, tambahkan restart policy, healthcheck, dan log rotation.
10. Baru setelah itu pertimbangkan pemindahan folder fisik dari struktur lama ke struktur `apps/`, `infra/`, `data/`, dan `models/`.

### 6.6. Contoh Perintah Operasional

```bash
cd /home/pacs/servers/infra/docker
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f backend-vismed
docker compose logs -f dicom-gateway
docker compose logs -f ai-vision-service
```

Untuk menghentikan service:

```bash
cd /home/pacs/servers/infra/docker
docker compose down
```

Gunakan `docker compose down` tanpa opsi `-v` agar volume data/model tidak ikut terhapus.
