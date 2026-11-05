import pydicom
from pydicom.dataset import Dataset, FileDataset
from pydicom.uid import generate_uid
from pydicom.encaps import encapsulate
import datetime

# ====== LOAD VIDEO ======
with open("video.mp4", "rb") as f:
    mp4_bytes = f.read()

print("MP4 SIZE:", len(mp4_bytes))

# ====== FILE META ======
file_meta = Dataset()
file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.77.1.4.1"  # Video Photographic
file_meta.MediaStorageSOPInstanceUID = generate_uid()
file_meta.TransferSyntaxUID = "1.2.840.10008.1.2.4.102"  # MPEG4 AVC
file_meta.ImplementationClassUID = generate_uid()

# ====== DATASET ======
ds = FileDataset("video.dcm", {}, file_meta=file_meta, preamble=b"\0" * 128)

# ====== IDENTITAS ======
ds.PatientName = "TEST^VIDEO"
ds.PatientID = "123456"

ds.StudyInstanceUID = generate_uid()
ds.SeriesInstanceUID = generate_uid()
ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID

ds.SOPClassUID = file_meta.MediaStorageSOPClassUID

# ====== TANGGAL ======
dt = datetime.datetime.now()
ds.StudyDate = dt.strftime("%Y%m%d")
ds.StudyTime = dt.strftime("%H%M%S")

# ====== 🔥 PENTING (MODALITY) ======
ds.Modality = "XC"   # ✅ BENAR untuk HDMI video
# ds.Modality = "ES"  # alternatif kalau mau strict endoscopy

# ====== DESKRIPSI ======
ds.StudyDescription = "Endoscopy Video"
ds.SeriesDescription = "HDMI Capture Endoscopy"

# ====== IMAGE / VIDEO ======
ds.ImageType = ["DERIVED", "PRIMARY", "VIDEO"]

ds.SamplesPerPixel = 3
ds.PhotometricInterpretation = "YBR_PARTIAL_420"
ds.PlanarConfiguration = 0

ds.Rows = 720      # sesuaikan dengan video
ds.Columns = 1280  # sesuaikan dengan video

ds.BitsAllocated = 8
ds.BitsStored = 8
ds.HighBit = 7
ds.PixelRepresentation = 0

# ====== FRAME INFO ======
ds.NumberOfFrames = "1"     # penting untuk video stream
ds.FrameTime = 33.3         # ~30 fps
ds.CineRate = 30

# ====== ENCAPSULATE ======
ds.PixelData = encapsulate([mp4_bytes])
ds["PixelData"].is_undefined_length = True

# ====== SAVE ======
ds.save_as("output.dcm", write_like_original=False)

print("DICOM video berhasil dibuat: output.dcm")
