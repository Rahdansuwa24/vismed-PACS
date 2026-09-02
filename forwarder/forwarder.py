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
    format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    handlers=[
        logging.FileHandler("forwarder.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

WATCH_DIR = os.getenv("WATCH_DIR", r"D:\PA\EDAN\EDAN")
ORTHANC_URL = os.getenv("ORTHANC_URL", "http://localhost:8042").rstrip("/")
ORTHANC_USERNAME = os.getenv("ORTHANC_USERNAME", "orthanc")
ORTHANC_PASSWORD = os.getenv("ORTHANC_PASSWORD", "orthanc")

DICOM_AET = os.getenv("DICOM_AET", "VISMED_FORWARDER")
DICOM_STATION_NAME = os.getenv("STATION_NAME", os.getenv("DICOM_STATION_NAME", "RUANG_EKG_1"))
DICOM_INSTITUTION_NAME = os.getenv("DICOM_INSTITUTION_NAME", "VISMED_HOSPITAL")


BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000").rstrip("/")

# Endpoint API SIMRS Mitra
SIMRS_CHECK_PELAYANAN_URL = os.getenv("SIMRS_CHECK_PELAYANAN_URL", "")
SIMRS_GET_TOKEN_URL = os.getenv("SIMRS_GET_TOKEN_URL", "")
SIMRS_UPLOAD_ECG_URL = os.getenv("SIMRS_UPLOAD_ECG_URL", "")


def send_log_to_backend(level, filename, nomor_pelayanan, status, message):
    """Kirim log ke backend Node.js untuk dimonitor secara real-time di dashboard React."""
    try:
        url = f"{BACKEND_URL}/pacs/ecg-log"
        payload = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "level": level,
            "filename": filename,
            "nomor_pelayanan": str(nomor_pelayanan),
            "status": status,  # "success", "error", "warning", "info"
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
        "orthancUrl": ORTHANC_URL,
        "stationName": DICOM_STATION_NAME
    }
    while True:
        try:
            requests.post(url, json=payload, timeout=2)
        except Exception:
            pass
        time.sleep(10)


class SIMRSClient:
    """Klien untuk integrasi 3 langkah ke API SIMRS Mitra."""

    @staticmethod
    def check_pelayanan(id_pelayanan):
        """
        Langkah 1: Cek Data Pelayanan
        POST param: { id_pelayanan: 1341420 }
        """
        if not SIMRS_CHECK_PELAYANAN_URL:
            logger.error("SIMRS_CHECK_PELAYANAN_URL belum dikonfigurasi di .env")
            return None

        try:
            payload = {
                "id_pelayanan": int(id_pelayanan) if str(id_pelayanan).isdigit() else id_pelayanan
            }
            logger.info(f"[SIMRS 1/3] Memanggil Cek Pelayanan ke {SIMRS_CHECK_PELAYANAN_URL} dengan payload: {payload}")
            response = requests.post(SIMRS_CHECK_PELAYANAN_URL, json=payload, timeout=10)
            
            logger.info(f"[SIMRS 1/3] Response status: {response.status_code}, Body: {response.text}")

            if response.status_code == 200:
                res_data = response.json()
                
                # Normalisasi struktur respon (mendukung {response: {...}}, {data: {...}}, atau flat JSON)
                candidate_data = res_data
                if isinstance(res_data, dict):
                    if "response" in res_data and isinstance(res_data["response"], dict):
                        candidate_data = res_data["response"]
                    elif "data" in res_data and isinstance(res_data["data"], dict):
                        candidate_data = res_data["data"]
                    elif "data" in res_data and isinstance(res_data["data"], list) and len(res_data["data"]) > 0:
                        candidate_data = res_data["data"][0]
                    elif "response" in res_data and isinstance(res_data["response"], list) and len(res_data["response"]) > 0:
                        candidate_data = res_data["response"][0]

                # Ekstraksi field dengan berbagai kemungkinan nama key dari SIMRS
                norm = (
                    candidate_data.get("norm") or 
                    candidate_data.get("no_rm") or 
                    candidate_data.get("nomor_rm") or 
                    candidate_data.get("no_rekam_medis") or 
                    candidate_data.get("no_rkm_medis") or 
                    candidate_data.get("Norm") or 
                    ""
                )
                
                birthdate = (
                    candidate_data.get("birthdate") or 
                    candidate_data.get("tgl_lahir") or 
                    candidate_data.get("tanggal_lahir") or 
                    candidate_data.get("birth_date") or 
                    candidate_data.get("tglLahir") or 
                    candidate_data.get("Birthdate") or 
                    "2024-03-01"
                )
                
                # Format birthdate jika berupa ISO date string (YYYY-MM-DDT...)
                if "T" in str(birthdate):
                    birthdate = str(birthdate).split("T")[0]

                nama_pasien = (
                    candidate_data.get("pasien") or 
                    candidate_data.get("nama_pasien") or 
                    candidate_data.get("nama") or 
                    candidate_data.get("nama_lengkap") or 
                    candidate_data.get("nm_pasien") or 
                    candidate_data.get("Nama") or 
                    f"Pasien_{id_pelayanan}"
                )

                
                kunjungan_id = (
                    candidate_data.get("kunjungan_id") or 
                    candidate_data.get("id_kunjungan") or 
                    candidate_data.get("no_rawat") or 
                    ""
                )
                
                pelayanan_id = (
                    candidate_data.get("pelayanan_id") or 
                    candidate_data.get("id_pelayanan") or 
                    id_pelayanan
                )
                
                pasien_id = (
                    candidate_data.get("pasien_id") or 
                    candidate_data.get("id_pasien") or 
                    ""
                )
                
                tanggal_kunjungan = (
                    candidate_data.get("tanggal_kunjungan") or 
                    candidate_data.get("tgl_kunjungan") or 
                    candidate_data.get("tgl_registrasi") or 
                    time.strftime("%d-%m-%Y")
                )

                patient_info = {
                    "norm": str(norm).strip(),
                    "birthdate": str(birthdate).strip(),
                    "nama_pasien": str(nama_pasien).strip(),
                    "kunjungan_id": str(kunjungan_id).strip(),
                    "pelayanan_id": str(pelayanan_id).strip(),
                    "pasien_id": str(pasien_id).strip(),
                    "tanggal_kunjungan": str(tanggal_kunjungan).strip(),
                    "jenis_kelamin": str(candidate_data.get("jenis_kelamin", "")).strip(),
                    "usia": candidate_data.get("usia", ""),
                    "unit": str(candidate_data.get("unit", "")).strip(),
                    "tgl": str(candidate_data.get("tgl", "")).strip()
                }

                logger.info(f"[SIMRS 1/3] Data pelayanan berhasil diparsing: {patient_info['nama_pasien']} (No.RM: {patient_info['norm']}, Unit: {patient_info['unit']})")
                return patient_info
            else:
                logger.error(f"[SIMRS 1/3] Gagal cek pelayanan. Status {response.status_code}: {response.text}")
                return None
        except Exception as e:
            logger.error(f"[SIMRS 1/3] Exception saat cek pelayanan: {e}")
            return None

    @staticmethod
    def get_token(norm, birthdate):
        """
        Langkah 2: Get Token
        POST param: { norm: "000120", birthdate: "2024-03-01" }
        """
        if not SIMRS_GET_TOKEN_URL:
            logger.error("SIMRS_GET_TOKEN_URL belum dikonfigurasi di .env")
            return None

        try:
            payload = {
                "norm": str(norm),
                "birthdate": str(birthdate)
            }
            logger.info(f"[SIMRS 2/3] Meminta Token ke {SIMRS_GET_TOKEN_URL} dengan payload: {payload}")
            response = requests.post(SIMRS_GET_TOKEN_URL, json=payload, timeout=10)
            
            logger.info(f"[SIMRS 2/3] Response status: {response.status_code}, Body: {response.text}")

            if response.status_code == 200:
                res_data = response.json()
                token = (
                    res_data.get("token") or 
                    res_data.get("data", {}).get("token") if isinstance(res_data.get("data"), dict) else None or 
                    res_data.get("response", {}).get("token") if isinstance(res_data.get("response"), dict) else None or
                    res_data.get("access_token")
                )
                if not token and isinstance(res_data, str):
                    token = res_data
                logger.info("[SIMRS 2/3] Token otentikasi berhasil didapatkan.")
                return token
            else:
                logger.error(f"[SIMRS 2/3] Gagal mendapatkan token. Status {response.status_code}: {response.text}")
                return None
        except Exception as e:
            logger.error(f"[SIMRS 2/3] Exception saat meminta token: {e}")
            return None


    @staticmethod
    def upload_ecg(image_bytes, patient_info, token, filename="ecg_result.png"):
        """
        Langkah 3: Upload Gambar ECG (multipart/form-data)
        Header: Authorization: Bearer <token>
        Param: files, tanggal_kunjungan, kunjungan_id, pelayanan_id, no_rm, nama_pasien, jenis_berkas, klaim, cetak_mcu, pasien_id
        """
        if not SIMRS_UPLOAD_ECG_URL:
            logger.error("SIMRS_UPLOAD_ECG_URL belum dikonfigurasi di .env")
            return False

        try:
            headers = {
                "Authorization": f"Bearer {token}"
            }
            form_data = {
                "tanggal_kunjungan": str(patient_info.get("tanggal_kunjungan", time.strftime("%d-%m-%Y"))),
                "kunjungan_id": str(patient_info.get("kunjungan_id", "")),
                "pelayanan_id": str(patient_info.get("pelayanan_id", "")),
                "no_rm": str(patient_info.get("norm", "")),
                "nama_pasien": str(patient_info.get("nama_pasien", "")),
                "jenis_berkas": "HASIL ECG",
                "klaim": "0",
                "cetak_mcu": "1",
                "pasien_id": str(patient_info.get("pasien_id", ""))
            }
            
            files = {
                "files": (filename, image_bytes, "image/png")
            }

            logger.info(f"[SIMRS 3/3] Mengunggah berkas gambar ECG ke {SIMRS_UPLOAD_ECG_URL} untuk No.RM: {form_data['no_rm']}")
            response = requests.post(
                SIMRS_UPLOAD_ECG_URL,
                headers=headers,
                data=form_data,
                files=files,
                timeout=20
            )

            if response.status_code in [200, 201]:
                logger.info(f"[SIMRS 3/3] Berhasil mengunggah gambar ECG ke SIMRS: {response.text}")
                return True
            else:
                logger.error(f"[SIMRS 3/3] Gagal upload ECG. Status {response.status_code}: {response.text}")
                return False
        except Exception as e:
            logger.error(f"[SIMRS 3/3] Exception saat upload gambar ECG: {e}")
            return False



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
            logger.info(f"File .dat detected ({filename}), skipping for now.")
            send_log_to_backend("INFO", filename, "-", "info", "File .dat terdeteksi, diabaikan.")
        else:
            logger.warning(f"Unsupported file format: {filename}")
            send_log_to_backend("WARNING", filename, "-", "warning", f"Format file tidak didukung: {filename}")

    def process_pdf(self, filepath, filename):
        # Tunggu sebentar agar FileZilla / FTP selesai menulis file
        time.sleep(2)
        
        try:
            # 1. Ekstrak nomor pelayanan dari nama file
            nomor_pelayanan = self.extract_nomor_pelayanan(filename)
            logger.info(f"Nomor pelayanan diekstrak: {nomor_pelayanan}")
            send_log_to_backend("INFO", filename, nomor_pelayanan, "info", f"Mengekstrak nomor pelayanan: {nomor_pelayanan}")

            # 2. Convert PDF to High-Resolution Image
            send_log_to_backend("INFO", filename, nomor_pelayanan, "info", "Memulai konversi PDF ke Gambar PNG...")
            image_data = self.convert_pdf_to_image(filepath)
            if not image_data:
                logger.error("Failed to convert PDF to Image.")
                send_log_to_backend("ERROR", filename, nomor_pelayanan, "error", "Gagal mengonversi PDF ke Gambar.")
                return

            # 3. Integrasi SIMRS Mitra (3 Langkah)
            patient_info = None
            if nomor_pelayanan != "UNKNOWN":
                # Langkah 1: Cek Data Pelayanan
                send_log_to_backend("INFO", filename, nomor_pelayanan, "info", f"[SIMRS 1/3] Mengecek data pelayanan: {nomor_pelayanan}...")
                patient_info = SIMRSClient.check_pelayanan(nomor_pelayanan)
                
                if patient_info:
                    send_log_to_backend("INFO", filename, nomor_pelayanan, "info", f"[SIMRS 1/3] Data pasien: {patient_info.get('nama_pasien')} (No.RM: {patient_info.get('norm')})")
                    
                    # Langkah 2: Get Token
                    send_log_to_backend("INFO", filename, nomor_pelayanan, "info", "[SIMRS 2/3] Meminta authentication token...")
                    token = SIMRSClient.get_token(patient_info.get("norm"), patient_info.get("birthdate"))
                    
                    if token:
                        send_log_to_backend("INFO", filename, nomor_pelayanan, "info", "[SIMRS 2/3] Token autentikasi berhasil didapatkan.")
                        
                        # Langkah 3: Upload Gambar ECG (form-data)
                        send_log_to_backend("INFO", filename, nomor_pelayanan, "info", "[SIMRS 3/3] Mengunggah gambar ECG form-data ke SIMRS...")
                        upload_success = SIMRSClient.upload_ecg(image_data, patient_info, token, filename=f"{nomor_pelayanan}.png")
                        
                        if upload_success:
                            send_log_to_backend("INFO", filename, nomor_pelayanan, "success", f"[SIMRS] Berhasil upload berkas ECG untuk No.RM {patient_info.get('norm')}.")
                        else:
                            send_log_to_backend("ERROR", filename, nomor_pelayanan, "error", "[SIMRS] Gagal mengunggah berkas ECG ke API SIMRS.")
                    else:
                        send_log_to_backend("ERROR", filename, nomor_pelayanan, "error", "[SIMRS] Gagal mendapatkan token otentikasi.")
                else:
                    send_log_to_backend("WARNING", filename, nomor_pelayanan, "warning", f"[SIMRS] Data pelayanan {nomor_pelayanan} tidak ditemukan di SIMRS.")
            else:
                send_log_to_backend("WARNING", filename, nomor_pelayanan, "warning", "Nomor pelayanan tidak terdeteksi, pengiriman ke SIMRS dilewati.")

            # 4. Create DICOM SC (Secondary Capture)
            dicom_dataset = self.create_dicom_sc(image_data, nomor_pelayanan, patient_info)
            send_log_to_backend("INFO", filename, nomor_pelayanan, "info", "Berhasil membungkus citra menjadi DICOM Secondary Capture.")

            # 5. Upload to Orthanc PACS
            dicom_bytes = self.dataset_to_bytes(dicom_dataset)
            self.upload_to_orthanc(dicom_bytes, filename, nomor_pelayanan)

        except Exception as e:
            logger.error(f"Error processing {filename}: {str(e)}", exc_info=True)
            send_log_to_backend("ERROR", filename, "-", "error", f"Gagal memproses file: {str(e)}")

    def extract_nomor_pelayanan(self, filename):
        # Format: YYYYMMDD-HHMMSS-<jenis>-<nomor_pelayanan>.pdf
        # Atau: YYYYMMDD-HHMMSS-<nomor_pelayanan>.pdf
        name_without_ext = os.path.splitext(filename)[0]
        parts = name_without_ext.split("-")
        
        # Ambil elemen terakhir setelah dipisah dengan '-'
        if len(parts) >= 2:
            return parts[-1]
        
        return "UNKNOWN"

    def convert_pdf_to_image(self, filepath):
        try:
            doc = fitz.open(filepath)
            page = doc.load_page(0)  # Ambil halaman pertama
            pix = page.get_pixmap(dpi=150)  # Resolusi tinggi 150 DPI
            
            # Convert ke bytes image (PNG)
            img_bytes = pix.tobytes("png")
            return img_bytes
        except Exception as e:
            logger.error(f"Error converting PDF: {e}")
            return None

    def create_dicom_sc(self, image_bytes, patient_id, patient_info=None):
        # Gunakan Pillow untuk membaca parameter gambar
        image = Image.open(BytesIO(image_bytes))
        image = image.convert('L')  # Convert to Grayscale untuk DICOM SC dasar
        
        # Inisialisasi Meta Info
        file_meta = FileMetaDataset()
        file_meta.MediaStorageSOPClassUID = SecondaryCaptureImageStorage
        file_meta.MediaStorageSOPInstanceUID = generate_uid()
        file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
        
        # Buat FileDataset instance
        ds = FileDataset(None, Dataset(), file_meta=file_meta, preamble=b"\0" * 128)
        
        # Data Pasien (Gunakan data riil SIMRS)
        patient_name = patient_info.get("nama_pasien") if patient_info else f"Patient_{patient_id}"
        no_rm = patient_info.get("norm") if patient_info else patient_id
        
        ds.PatientName = str(patient_name)
        ds.PatientID = str(no_rm)
        ds.Modality = "ECG"
        ds.StationName = DICOM_STATION_NAME
        ds.InstitutionName = DICOM_INSTITUTION_NAME
        ds.SeriesDescription = "ECG Edan 1200 Express MCU"
        
        unit_name = patient_info.get("unit") if patient_info else ""
        ds.StudyDescription = f"ECG - {unit_name}" if unit_name else "Pemeriksaan ECG"
        ds.AccessionNumber = str(patient_id)
        
        # Numbering penting agar Orthanc tidak menampilkan 'Instance: null'
        ds.SeriesNumber = "1"
        ds.InstanceNumber = "1"
        
        # Demografi Pasien dari SIMRS
        if patient_info:
            # Gender (M/F/O)
            jk = str(patient_info.get("jenis_kelamin", "")).upper()
            if "LAK" in jk or jk == "M" or jk == "MALE":
                ds.PatientSex = "M"
            elif "PER" in jk or "WAN" in jk or jk == "F" or jk == "FEMALE":
                ds.PatientSex = "F"
            else:
                ds.PatientSex = "O"

            # Age
            usia = patient_info.get("usia")
            if usia and str(usia).isdigit():
                ds.PatientAge = f"{int(usia):03d}Y"

            # Tanggal Lahir jika tersedia
            if patient_info.get("birthdate"):
                clean_dob = patient_info.get("birthdate").replace("-", "")
                ds.PatientBirthDate = clean_dob

            # Tanggal Pemeriksaan
            tgl_simrs = patient_info.get("tgl") or patient_info.get("tanggal_kunjungan")
            if tgl_simrs:
                clean_date = str(tgl_simrs).replace("-", "").replace("/", "")
                if len(clean_date) == 8:
                    ds.StudyDate = clean_date
                    ds.SeriesDate = clean_date
                    ds.ContentDate = clean_date
                    ds.InstanceCreationDate = clean_date
            else:
                now_date = time.strftime("%Y%m%d")
                ds.StudyDate = now_date
                ds.SeriesDate = now_date
                ds.ContentDate = now_date
                ds.InstanceCreationDate = now_date
        else:
            now_date = time.strftime("%Y%m%d")
            ds.StudyDate = now_date
            ds.SeriesDate = now_date
            ds.ContentDate = now_date
            ds.InstanceCreationDate = now_date

        now_time = time.strftime("%H%M%S")
        ds.StudyTime = now_time
        ds.SeriesTime = now_time
        ds.ContentTime = now_time
        ds.InstanceCreationTime = now_time

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
