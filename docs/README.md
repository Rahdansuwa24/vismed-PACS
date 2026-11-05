# Dokumentasi VisMed PACS

Folder ini berisi dokumentasi utama proyek. Dokumen dipisahkan berdasarkan fungsi supaya lebih mudah dicari dan dirawat.

## Struktur

```text
docs/
├─ architecture/
│  └─ peningkatan_keandalan_vision.md
├─ deployment/
│  └─ forwarder_deployment_plan.md
├─ installation/
│  └─ INSTALLATION_GUIDE.md
├─ models/
│  └─ listing_model.md
├─ prd/
│  ├─ PRD-01_Windows_Frontend.md
│  ├─ PRD-02_VM_Backend.md
│  └─ PRD_Integrasi_ECG_Orthanc.md
└─ archive/
   └─ empty-placeholders/
      └─ vismed-PACS/
```

## Kategori

- `installation/`: panduan instalasi dan setup environment.
- `prd/`: product requirement document dan desain integrasi lintas sistem.
- `architecture/`: catatan teknis, reliability, dan rancangan arsitektur.
- `models/`: daftar dan informasi model AI/vision.
- `deployment/`: rencana deployment, startup, dan operasional.
- `archive/empty-placeholders/`: file Markdown kosong lama yang disimpan sementara agar tidak tercampur dengan dokumen aktif.

README milik modul, seperti `apps/ai-vision-service/README.md` dan `apps/frontend/README.md`, tetap berada di folder modul masing-masing.
