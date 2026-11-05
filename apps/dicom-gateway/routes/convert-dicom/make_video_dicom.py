import sys
import os
import json
import argparse

import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import UID
from pydicom.encaps import encapsulate

# ─────────────────────────────────────────────────────────────
# SOP CLASS
# Video Endoscopic Image Storage
# ─────────────────────────────────────────────────────────────
SOP_CLASS = "1.2.840.10008.5.1.4.1.1.77.1.4.1"

# MPEG4 AVC / H264 HP 4.1
TRANSFER_SYNTAX = "1.2.840.10008.1.2.4.102"


def make_dicom(p: dict):

    # ─────────────────────────────────────────────────────────
    # READ MP4
    # ─────────────────────────────────────────────────────────
    with open(p["mp4Path"], "rb") as f:
        mp4_bytes = f.read()

    # ─────────────────────────────────────────────────────────
    # FILE META
    # ─────────────────────────────────────────────────────────
    file_meta = FileMetaDataset()

    file_meta.MediaStorageSOPClassUID = UID(SOP_CLASS)
    file_meta.MediaStorageSOPInstanceUID = UID(p["sopUID"])
    file_meta.TransferSyntaxUID = UID(TRANSFER_SYNTAX)

    file_meta.ImplementationClassUID = UID(
        "1.2.826.0.1.3680043.10.188.1"
    )

    file_meta.ImplementationVersionName = "PYDICOMVIDEO"

    # ─────────────────────────────────────────────────────────
    # DATASET
    # ─────────────────────────────────────────────────────────
    ds = FileDataset(
        p["dcmPath"],
        {},
        file_meta=file_meta,
        preamble=b"\0" * 128
    )

    ds.is_little_endian = True
    ds.is_implicit_VR = False

    # ─────────────────────────────────────────────────────────
    # PATIENT
    # ─────────────────────────────────────────────────────────
    ds.PatientName = p.get("patientName", "ANONYMOUS")
    ds.PatientID = p.get("patientID", "UNKNOWN")
    ds.PatientBirthDate = p.get("patientDOB", "")
    ds.PatientSex = p.get("patientSex", "")

    # ─────────────────────────────────────────────────────────
    # STUDY
    # ─────────────────────────────────────────────────────────
    ds.StudyInstanceUID = p["studyUID"]

    ds.StudyDate = p["date"]
    ds.StudyTime = p["time"]

    ds.AccessionNumber = p.get("accessionNumber", "")

    ds.ReferringPhysicianName = p.get(
        "referringPhysician",
        ""
    )

    ds.StudyDescription = "VIDEO ENDOSCOPY"

    # ─────────────────────────────────────────────────────────
    # SERIES
    # ─────────────────────────────────────────────────────────
    ds.SeriesInstanceUID = p["seriesUID"]

    ds.SeriesNumber = "1"

    # HARDCODE XC
    ds.Modality = "ES"

    ds.SeriesDescription = "Endoscopy Video"

    ds.BodyPartExamined = p.get("bodypart", "")

    ds.SeriesDate = p["date"]
    ds.SeriesTime = p["time"]

    # ─────────────────────────────────────────────────────────
    # EQUIPMENT
    # ─────────────────────────────────────────────────────────
    ds.Manufacturer = p.get("manufacturer", "CUSTOM")

    ds.ManufacturerModelName = p.get(
        "modelName",
        "VideoConverter"
    )

    ds.SoftwareVersions = "1.0"

    ds.InstitutionName = p.get("institution", "")

    # ─────────────────────────────────────────────────────────
    # SOP
    # ─────────────────────────────────────────────────────────
    ds.SOPClassUID = UID(SOP_CLASS)

    ds.SOPInstanceUID = UID(p["sopUID"])

    ds.InstanceNumber = "1"

    ds.ContentDate = p["date"]
    ds.ContentTime = p["time"]

    ds.AcquisitionDateTime = (
        p["date"] + p["time"]
    )

    ds.SpecificCharacterSet = "ISO_IR 192"

    ds.ImageType = ["DERIVED", "PRIMARY"]

    ds.BurnedInAnnotation = "NO"

    ds.PresentationLUTShape = "IDENTITY"


    ds.RecognizableVisualFeatures = "YES"

    ds.ConversionType = "WSD"

    ds.PixelSpacing = [1, 1]
    # ─────────────────────────────────────────────────────────
    # VIDEO
    # ─────────────────────────────────────────────────────────
    width = int(p["width"])
    height = int(p["height"])

    fps = float(p["fps"])

    total_frames = int(p["totalFrames"])

    frame_time = round(1000 / fps, 4)

    ds.Rows = height
    ds.Columns = width

    ds.NumberOfFrames = str(total_frames)

    ds.FrameTime = str(frame_time)

    ds.CineRate = int(round(fps))

    ds.FrameIncrementPointer = [0x00181063]

    # ─────────────────────────────────────────────────────────
    # PIXEL FORMAT
    # ─────────────────────────────────────────────────────────
    ds.SamplesPerPixel = 3

    ds.PhotometricInterpretation = "YBR_PARTIAL_420"

    ds.PlanarConfiguration = 0

    ds.BitsAllocated = 8
    ds.BitsStored = 8

    ds.HighBit = 7

    ds.PixelRepresentation = 0

    #ds.PixelAspectRatio = "1\\1"

    # ─────────────────────────────────────────────────────────
    # LOSSY COMPRESSION
    # ─────────────────────────────────────────────────────────
    ds.LossyImageCompression = "01"

    ds.LossyImageCompressionRatio = "10"

    ds.LossyImageCompressionMethod = "ISO_14496_10"

    # ─────────────────────────────────────────────────────────
    # ENCAPSULATE VIDEO
    # ─────────────────────────────────────────────────────────
    # JANGAN gunakan encapsulate_extended()
    # OHIF lebih stabil dengan encapsulate biasa
    # ─────────────────────────────────────────────────────────
    ds.PixelData = encapsulate([mp4_bytes])

    ds["PixelData"].is_undefined_length = True

    # ─────────────────────────────────────────────────────────
    # SAVE
    # ─────────────────────────────────────────────────────────
    pydicom.dcmwrite(
        p["dcmPath"],
        ds,
        write_like_original=False
    )

    size_mb = os.path.getsize(
        p["dcmPath"]
    ) / 1024 / 1024

    print(
        f"OK|{size_mb:.2f}|{width}x{height}|{total_frames}"
    )


# ─────────────────────────────────────────────────────────────
# ENTRY
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--params",
        required=True
    )

    args = parser.parse_args()

    with open(args.params, "r", encoding="utf-8") as f:
        params = json.load(f)

    make_dicom(params)
