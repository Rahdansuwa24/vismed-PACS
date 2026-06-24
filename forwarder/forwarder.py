import os
import time
import logging
import threading
from io import BytesIO
import requests
from dotenv import load_dotenv
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

import fitz  # PyMuPDF
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset, Dataset
from pydicom.uid import generate_uid, SecondaryCaptureImageStorage, ExplicitVRLittleEndian
from PIL import Image

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("forwarder.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
WATCH_DIR = os.getenv("WATCH_DIR", r"D:\PA\EDAN\EDAN")
ORTHANC_URL = os.getenv("ORTHANC_URL", "http://localhost:8042")
ORTHANC_USERNAME = os.getenv("ORTHANC_USERNAME", "orthanc")
ORTHANC_PASSWORD = os.getenv("ORTHANC_PASSWORD", "orthanc")
DICOM_AET = os.getenv("DICOM_AET", "VISMED_FORWARDER")
SIMRS_API_URL = os.getenv("SIMRS_API_URL", "http://localhost:3000/api/simrs/mock")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")

def send_log_to_backend(level, filename, nomor_pelayanan, status, message):
    """Kirim log ke backend Node.js untuk dimonitor di dashboard React."""
    try:
        url = f"{BACKEND_URL}/pacs/ecg-log"
        payload = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "level": level,
            "filename": filename,
            "nomor_pelayanan": nomor_pelayanan,
            "status": status,
            "message": message
        }
        requests.post(url, json=payload, timeout=2)
    except Exception as e:
        logger.debug(f"Gagal mengirim log ke backend: {e}")

def heartbeat_loop():
    """Mengirim ping berkala ke backend untuk menandakan forwarder aktif."""
    url = f"{BACKEND_URL}/pacs/ecg-heartbeat"
    payload = {
        "watchDir": WATCH_DIR,
        "orthancUrl": ORTHANC_URL
    }
    while True:
        try:
            requests.post(url, json=payload, timeout=2)
        except Exception:
            pass
        time.sleep(10)

class ECGFtpHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return

        filepath = event.src_path
        filename = os.path.basename(filepath)

        logger.info(f"New file detected: {filename}")
        send_log_to_backend("INFO", filename, "-", "info", f"File baru terdeteksi: {filename}")

        if filename.lower().endswith(".pdf"):
            self.process_pdf(filepath, filename)
        elif filename.lower().endswith(".dat"):
            logger.info(f"File .dat detected ({filename}), skipping for now as per PRD.")
            send_log_to_backend("INFO", filename, "-", "info", "File .dat terdeteksi, diabaikan sesuai PRD.")
        else:
            logger.warning(f"Unsupported file format: {filename}")
            send_log_to_backend("WARNING", filename, "-", "warning", f"Format file tidak didukung: {filename}")

    def process_pdf(self, filepath, filename):
        # Tunggu sebentar agar FileZilla selesai menulis file
        time.sleep(2)
        
        try:
            # 1. Ekstrak nomor pelayanan
            nomor_pelayanan = self.extract_nomor_pelayanan(filename)
            logger.info(f"Nomor pelayanan diekstrak: {nomor_pelayanan}")
            send_log_to_backend("INFO", filename, nomor_pelayanan, "info", f"Mengekstrak nomor pelayanan: {nomor_pelayanan}")

            # 2. Convert PDF to Image
            send_log_to_backend("INFO", filename, nomor_pelayanan, "info", "Memulai konversi PDF ke Gambar...")
            image_data = self.convert_pdf_to_image(filepath)
            if not image_data:
                logger.error("Failed to convert PDF to Image.")
                send_log_to_backend("ERROR", filename, nomor_pelayanan, "error", "Gagal mengonversi PDF ke Gambar.")
                return

            # 3. Create DICOM SC
            dicom_dataset = self.create_dicom_sc(image_data, nomor_pelayanan)
            send_log_to_backend("INFO", filename, nomor_pelayanan, "info", "Berhasil membungkus gambar menjadi DICOM Secondary Capture.")

            # 4. Upload to Orthanc
            dicom_bytes = self.dataset_to_bytes(dicom_dataset)
            self.upload_to_orthanc(dicom_bytes, filename, nomor_pelayanan)

            # 5. Mock Upload to SIMRS
            self.mock_upload_simrs(nomor_pelayanan, filename)

        except Exception as e:
            logger.error(f"Error processing {filename}: {str(e)}", exc_info=True)
            send_log_to_backend("ERROR", filename, "-", "error", f"Gagal memproses file: {str(e)}")

    def extract_nomor_pelayanan(self, filename):
        # Format: YYYYMMDD-HHMMSS-<jenis>-<nomor_pelayanan>.pdf
        # Atau: YYYYMMDD-HHMMSS-<nomor_pelayanan>.pdf
        name_without_ext = os.path.splitext(filename)[0]
        parts = name_without_ext.split("-")
        
        # Ambil elemen terakhir setelah dipisah dengan '-'
        if len(parts) >= 3:
            return parts[-1]
        
        return "UNKNOWN"

    def convert_pdf_to_image(self, filepath):
        try:
            doc = fitz.open(filepath)
            page = doc.load_page(0)  # Ambil halaman pertama
            pix = page.get_pixmap(dpi=150) # Resolusi cukup baik
            
            # Convert ke bytes image (PNG)
            img_bytes = pix.tobytes("png")
            return img_bytes
        except Exception as e:
            logger.error(f"Error converting PDF: {e}")
            return None

    def create_dicom_sc(self, image_bytes, patient_id):
        # Gunakan Pillow untuk membaca parameter gambar
        image = Image.open(BytesIO(image_bytes))
        image = image.convert('L') # Convert to Grayscale untuk DICOM SC dasar
        
        # Inisialisasi Meta Info
        file_meta = FileMetaDataset()
        file_meta.MediaStorageSOPClassUID = SecondaryCaptureImageStorage
        file_meta.MediaStorageSOPInstanceUID = generate_uid()
        file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
        
        # Buat FileDataset instance (kosongkan filename untuk sementara)
        ds = FileDataset(None, Dataset(), file_meta=file_meta, preamble=b"\0" * 128)
        
        # Atur elemen DICOM
        ds.PatientName = f"Patient_{patient_id}"
        ds.PatientID = patient_id
        ds.Modality = "ECG"
        ds.SOPClassUID = SecondaryCaptureImageStorage
        ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
        ds.StudyInstanceUID = generate_uid()
        ds.SeriesInstanceUID = generate_uid()
        
        # Informasi Gambar
        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.PixelRepresentation = 0
        ds.HighBit = 7
        ds.BitsStored = 8
        ds.BitsAllocated = 8
        ds.Columns = image.width
        ds.Rows = image.height
        
        ds.PixelData = image.tobytes()
        
        return ds

    def dataset_to_bytes(self, dataset):
        with BytesIO() as buffer:
            # Menggunakan enforce_file_format=False untuk menghindari warning deprecation
            pydicom.dcmwrite(buffer, dataset, enforce_file_format=False)
            return buffer.getvalue()

    def upload_to_orthanc(self, dicom_bytes, original_filename, nomor_pelayanan):
        headers = {'Content-Type': 'application/dicom'}
        auth = (ORTHANC_USERNAME, ORTHANC_PASSWORD)
        
        url = f"{ORTHANC_URL}/instances"
        try:
            response = requests.post(url, data=dicom_bytes, headers=headers, auth=auth)
            if response.status_code == 200:
                logger.info(f"Berhasil diunggah ke Orthanc: {original_filename}")
                send_log_to_backend("INFO", original_filename, nomor_pelayanan, "success", "Berhasil mengunggah file DICOM SC ke Orthanc PACS.")
            else:
                logger.error(f"Gagal mengunggah ke Orthanc, status {response.status_code}: {response.text}")
                send_log_to_backend("ERROR", original_filename, nomor_pelayanan, "error", f"Gagal unggah ke Orthanc (Status {response.status_code}): {response.text}")
        except Exception as e:
            logger.error(f"Gagal menghubungi Orthanc API: {e}")
            send_log_to_backend("ERROR", original_filename, nomor_pelayanan, "error", f"Gagal menghubungi Orthanc API: {e}")

    def mock_upload_simrs(self, nomor_pelayanan, filename):
        if nomor_pelayanan == "UNKNOWN":
            logger.warning(f"File {filename} tidak memiliki nomor pelayanan valid. Tidak dikirim ke SIMRS.")
            send_log_to_backend("WARNING", filename, nomor_pelayanan, "warning", "Nomor pelayanan tidak valid, pengiriman SIMRS dilewati.")
            return

        # Mock check data
        logger.info(f"[SIMRS MOCK] Memeriksa kecocokan nomor pelayanan: {nomor_pelayanan}")
        logger.info(f"[SIMRS MOCK] Data cocok. Mengirim gambar ECG ke SIMRS API untuk: {nomor_pelayanan}")
        send_log_to_backend("INFO", filename, nomor_pelayanan, "success", f"[SIMRS MOCK] Pengiriman berhasil untuk pasien dengan nomor pelayanan: {nomor_pelayanan}")


if __name__ == "__main__":
    if not os.path.exists(WATCH_DIR):
        logger.error(f"Directory {WATCH_DIR} tidak ditemukan. Memastikan direktori dibuat...")
        os.makedirs(WATCH_DIR, exist_ok=True)

    # Jalankan background thread untuk heartbeat ke backend
    heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    heartbeat_thread.start()

    event_handler = ECGFtpHandler()
    observer = Observer()
    observer.schedule(event_handler, WATCH_DIR, recursive=False)
    
    logger.info(f"Memulai pemantauan folder: {WATCH_DIR}")
    send_log_to_backend("INFO", "-", "-", "info", f"Memulai pemantauan folder FTP: {WATCH_DIR}")
    observer.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        logger.info("Pemantauan dihentikan.")
        send_log_to_backend("INFO", "-", "-", "warning", "Pemantauan dihentikan secara manual (KeyboardInterrupt).")
    observer.join()
