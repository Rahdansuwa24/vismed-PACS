# PRD-01: VisMed — Windows Environment
### Product Requirements Document (Frontend & Primary Backend)

**Versi:** 2.1 (Split-Backend Architecture)  
**Tanggal:** Juni 2026  
**Penulis:** Tim VisMed  
**Dokumen Terkait:** [`PRD-02_VM_Backend.md`](./PRD-02_VM_Backend.md)

---

## 1. Ringkasan Sistem
Lingkungan **Windows** bertindak sebagai *Client Interface* utama dan *Primary Backend*. Untuk mengoptimalkan kecepatan respons AI, arsitektur *backend* dipecah menjadi dua (*microservices*). Backend Windows tetap menangani fitur inti rumah sakit, sementara rute berat seperti pemanggilan AI Chat (Ollama) dan pemrosesan AI Visi (ONNX) didelegasikan ke *Backend* pembantu yang ada di VM.

---

## 2. Frontend (React.js - Port 5173)
Bertugas sebagai antarmuka visual (UI) bagi para dokter.
*   **DICOM Viewer & Dashboard:** Menampilkan gambar medis dan antrean pasien.
*   **AI Chat Interface:** Menampilkan obrolan klinis.

---

## 3. Primary Backend (Node.js - Port 3000)
Ini adalah server utama di komputer Windows. Endpoint yang dikelola meliputi:
*   **Orthanc Proxy & DICOM:** Mengambil dan melayani data gambar dari server Orthanc lokal.
*   **Modality Worklist (MWL):** Melayani data pasien.
*   **Pemindahan Fitur AI:** *Endpoint* untuk menghubungi Ollama LLM telah dihapus dari server Windows ini untuk mencegah *Request Timeout*. Pemanggilan *chat* AI kini diarahkan langsung ke VM `10.9.23.18:4000`.

---

## 4. Peta Koneksi Jaringan (Split-Backend)

Arsitektur ini memastikan Frontend React tidak mengalami *timeout* saat memanggil AI, karena Server Windows tidak lagi menjadi perantara (*middleman*) untuk obrolan Ollama.

```text
┌──────────────────────────────────────────────┐
│           WINDOWS (Local Machine)            │
│                                              │
│   Frontend (React UI)  <─────────┐           │
│   Port: 5173                     │           │
│        │                         │           │
│        │ HTTP API (Data Standar) │           │
│        ▼                         │           │
│   Primary Backend (Node.js) ─────┘           │
│   Port: 3000                                 │
└────────┼─────────────────────────────────────┘
         │
         │ HTTP API (Khusus Analisis & Chat AI)
┌────────▼─────────────────────────────────────┐
│                                VM 10.9.23.18 │
│   AI Microservice Backend (Node.js)          │
│   Port: 4000                                 │
│        │                                     │
│        ├──────► ONNX Vision (Port: 5000)     │
│        │                                     │
│        └──────► Ollama LLM (10.9.23.205)     │
└──────────────────────────────────────────────┘
```
