import sys
import os
import json
import argparse
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import UID
from pydicom.encaps import encapsulate

SOP_CLASS = "1.2.840.10008.5.1.4.1.1.3.1"  # Ultrasound Multi-frame Image Storage
TRANSFER_SYNTAX = "1.2.840.10008.1.2.4.50"  # JPEG Baseline (Process 1)

def make_dicom_jpeg(p: dict):
    # Read all JPEG frame bytes
    jpeg_bytes_list = []
    for path in p["jpegPaths"]:
        with open(path, "rb") as f:
            jpeg_bytes_list.append(f.read())

    # File Meta Information
    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = UID(SOP_CLASS)
    file_meta.MediaStorageSOPInstanceUID = UID(p["sopUID"])
    file_meta.TransferSyntaxUID = UID(TRANSFER_SYNTAX)
    file_meta.ImplementationClassUID = UID("1.2.826.0.1.3680043.10.188.1")
    file_meta.ImplementationVersionName = "PYDICOMJPEG"

    # Dataset
    ds = FileDataset(p["dcmPath"], {}, file_meta=file_meta, preamble=b"\0" * 128)
    ds.is_little_endian = True
    ds.is_implicit_VR = False

    # Patient tags
    ds.PatientName = p.get("patientName", "ANONYMOUS")
    ds.PatientID = p.get("patientID", "UNKNOWN")
    ds.PatientBirthDate = p.get("patientDOB", "")
    ds.PatientSex = p.get("patientSex", "")

    # Study tags
    ds.StudyInstanceUID = p["studyUID"]
    ds.StudyDate = p["date"]
    ds.StudyTime = p["time"]
    ds.AccessionNumber = p.get("accessionNumber", "")
    ds.ReferringPhysicianName = p.get("referringPhysician", "")
    ds.StudyDescription = "VIDEO ENDOSCOPY"

    # Series tags
    ds.SeriesInstanceUID = p["seriesUID"]
    ds.SeriesNumber = "1"
    ds.Modality = p.get("modality", "ES")
    ds.SeriesDescription = "Endoscopy Video"
    ds.BodyPartExamined = p.get("bodypart", "")
    ds.SeriesDate = p["date"]
    ds.SeriesTime = p["time"]

    # Equipment tags
    ds.Manufacturer = p.get("manufacturer", "CUSTOM")
    ds.ManufacturerModelName = p.get("modelName", "VideoConverter")
    ds.SoftwareVersions = "1.0"
    ds.InstitutionName = p.get("institution", "")

    # SOP Instance tags
    ds.SOPClassUID = UID(SOP_CLASS)
    ds.SOPInstanceUID = UID(p["sopUID"])
    ds.InstanceNumber = "1"

    ds.ContentDate = p["date"]
    ds.ContentTime = p["time"]
    ds.AcquisitionDateTime = p["date"] + p["time"]
    ds.SpecificCharacterSet = "ISO_IR 192"
    ds.ImageType = ["DERIVED", "PRIMARY"]
    ds.BurnedInAnnotation = "NO"
    ds.PresentationLUTShape = "IDENTITY"

    # Image geometry / pixel format
    fps = float(p["fps"])
    frame_time = round(1000 / fps, 4)

    ds.Rows = int(p["height"])
    ds.Columns = int(p["width"])
    ds.NumberOfFrames = str(len(jpeg_bytes_list))
    ds.FrameTime = str(frame_time)
    ds.CineRate = int(round(fps))
    ds.FrameIncrementPointer = [0x00181063]  # Points to FrameTime tag (0018,1063)

    ds.SamplesPerPixel = 3
    ds.PhotometricInterpretation = "YBR_FULL_422" # Standard for JPEG Baseline in DICOM
    ds.PlanarConfiguration = 0
    ds.BitsAllocated = 8
    ds.BitsStored = 8
    ds.HighBit = 7
    ds.PixelRepresentation = 0

    # Lossy compression info
    ds.LossyImageCompression = "01"
    ds.LossyImageCompressionRatio = "10"
    ds.LossyImageCompressionMethod = "ISO_10918_1"  # JPEG Lossy

    # Encapsulate JPEGs into PixelData
    ds.PixelData = encapsulate(jpeg_bytes_list)
    ds["PixelData"].is_undefined_length = True

    # Save
    pydicom.dcmwrite(p["dcmPath"], ds, write_like_original=False)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--params", required=True)
    args = parser.parse_args()

    with open(args.params, "r", encoding="utf-8") as f:
        params = json.load(f)

    make_dicom_jpeg(params)
