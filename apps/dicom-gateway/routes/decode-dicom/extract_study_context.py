import argparse
import base64
import io
import json
import urllib.request
import urllib.parse
from PIL import Image
import sys

def make_orthanc_request(url, username, password, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    
    # Setup Basic Auth
    auth_str = f"{username}:{password}"
    auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    headers["Authorization"] = f"Basic {auth_b64}"
    
    req = urllib.request.Request(url, headers=headers, method=method)
    if data is not None:
        if isinstance(data, (dict, list)):
            data = json.dumps(data).encode("utf-8")
            req.add_header("Content-Type", "application/json")
        req.data = data
        
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.read()
    except Exception as e:
        print(f"Error requesting {url}: {e}", file=sys.stderr)
        raise

def resize_and_encode_image(image_bytes, format_str, max_dim, jpeg_quality):
    try:
        img = Image.open(io.BytesIO(image_bytes))
        # Keep original format if possible, otherwise use PNG/JPEG
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
            
        w, h = img.size
        if max(w, h) > max_dim:
            if w > h:
                new_w = max_dim
                new_h = int(h * (max_dim / w))
            else:
                new_h = max_dim
                new_w = int(w * (max_dim / h))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
        out_buf = io.BytesIO()
        img_format = "PNG" if format_str.lower() == "png" else "JPEG"
        
        save_args = {}
        if img_format == "JPEG":
            save_args["quality"] = jpeg_quality
            
        img.save(out_buf, format=img_format, **save_args)
        return base64.b64encode(out_buf.getvalue()).decode("utf-8")
    except Exception as e:
        print(f"Error processing image: {e}", file=sys.stderr)
        # Fallback to raw base64 if PIL fails
        return base64.b64encode(image_bytes).decode("utf-8")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--params", required=True, help="Path to params JSON file")
    args = parser.parse_args()
    
    with open(args.params, "r", encoding="utf-8") as f:
        params = json.load(f)
        
    orthanc_cfg = params["orthanc"]
    orthanc_url = orthanc_cfg["url"].rstrip("/")
    username = orthanc_cfg.get("username", "orthanc")
    password = orthanc_cfg.get("password", "orthanc")
    
    study_instance_uid = params.get("studyInstanceUid")
    orthanc_study_id = params.get("orthancStudyId")
    include_images = params.get("includeImages", True)
    max_images = params.get("maxImages", 6)
    max_video_frames = params.get("maxVideoFrames", 3)
    image_format = params.get("imageFormat", "png")
    max_dimension = params.get("maxDimension", 1024)
    jpeg_quality = params.get("jpegQuality", 70)
    
    # 1. Find the Orthanc Study ID if not given
    if not orthanc_study_id and study_instance_uid:
        find_url = f"{orthanc_url}/tools/find"
        find_query = {
            "Level": "Study",
            "Query": {
                "StudyInstanceUID": study_instance_uid
            }
        }
        res_bytes = make_orthanc_request(find_url, username, password, method="POST", data=find_query)
        res_list = json.loads(res_bytes.decode("utf-8"))
        if res_list:
            orthanc_study_id = res_list[0]
        else:
            raise RuntimeError(f"Study with instance UID {study_instance_uid} not found in Orthanc")
            
    if not orthanc_study_id:
        raise RuntimeError("No studyInstanceUid or orthancStudyId provided")
        
    # 2. Get Study Details
    study_url = f"{orthanc_url}/studies/{orthanc_study_id}"
    study_bytes = make_orthanc_request(study_url, username, password)
    study_data = json.loads(study_bytes.decode("utf-8"))
    
    patient_tags = study_data.get("PatientMainDicomTags", {})
    study_tags = study_data.get("MainDicomTags", {})
    
    # 3. Get All Instances of the Study
    instances_url = f"{orthanc_url}/studies/{orthanc_study_id}/instances"
    instances_bytes = make_orthanc_request(instances_url, username, password)
    instances_list = json.loads(instances_bytes.decode("utf-8"))
    
    total_instances = len(instances_list)
    
    # Sort instances (usually by index or instance number if available)
    # For now, let's sort by ID to be deterministic
    instances_list.sort(key=lambda x: x.get("ID", ""))
    
    # Sample instances
    sampled_instances_data = []
    
    # Step: build context text
    patient_name = patient_tags.get("PatientName", "Unknown")
    patient_id = patient_tags.get("PatientID", "Unknown")
    patient_sex = patient_tags.get("PatientSex", "Unknown")
    patient_dob = patient_tags.get("PatientBirthDate", "Unknown")
    study_date = study_tags.get("StudyDate", "Unknown")
    study_desc = study_tags.get("StudyDescription", "Unknown")
    study_uid = study_tags.get("StudyInstanceUID", "Unknown")
    
    context_lines = [
        f"Patient Name: {patient_name}",
        f"Patient ID: {patient_id}",
        f"Patient Sex: {patient_sex}",
        f"Patient DOB: {patient_dob}",
        f"Study Date: {study_date}",
        f"Study Description: {study_desc}",
        f"Study Instance UID: {study_uid}",
        f"Total Instances: {total_instances}"
    ]
    
    limit = min(max_images, total_instances)
    
    for idx in range(limit):
        instance = instances_list[idx]
        instance_id = instance.get("ID")
        
        # Get simplified tags for this instance
        tags_url = f"{orthanc_url}/instances/{instance_id}/simplified-tags"
        try:
            tags_bytes = make_orthanc_request(tags_url, username, password)
            tags = json.loads(tags_bytes.decode("utf-8"))
        except Exception:
            tags = {}
            
        modality = tags.get("Modality", "Unknown")
        series_desc = tags.get("SeriesDescription", "Unknown")
        body_part = tags.get("BodyPartExamined", "Unknown")
        
        # Check if instance is multi-frame (video)
        num_frames_str = tags.get("NumberOfFrames", "1")
        try:
            num_frames = int(num_frames_str)
        except ValueError:
            num_frames = 1
            
        instance_entry = {
            "orthancInstanceId": instance_id,
            "index": idx,
            "selectedIndex": idx,
            "mimeType": "image/jpeg" if image_format.lower() == "jpeg" else "image/png",
            "mediaType": "video-frame" if num_frames > 1 else "image",
            "metadata": {
                "SeriesDescription": series_desc,
                "BodyPartExamined": body_part,
                "Modality": modality
            }
        }
        
        if include_images:
            if modality in ("ECG", "EKG"):
                instance_entry["imagePngBase64"] = None
                instance_entry["mediaType"] = "waveform"
            elif num_frames > 1:
                # Multi-frame video
                frames_b64 = []
                # Sample frames evenly
                frame_indices = []
                if num_frames <= max_video_frames:
                    frame_indices = list(range(num_frames))
                else:
                    step = num_frames / max_video_frames
                    frame_indices = [int(i * step) for i in range(max_video_frames)]
                    
                for f_idx in frame_indices:
                    frame_url = f"{orthanc_url}/instances/{instance_id}/frames/{f_idx}/preview"
                    try:
                        frame_bytes = make_orthanc_request(frame_url, username, password)
                        b64 = resize_and_encode_image(frame_bytes, image_format, max_dimension, jpeg_quality)
                        frames_b64.append(b64)
                    except Exception as e:
                        print(f"Error getting frame {f_idx}: {e}", file=sys.stderr)
                instance_entry["videoFramePngBase64"] = frames_b64
            else:
                # Single frame image
                preview_url = f"{orthanc_url}/instances/{instance_id}/preview"
                try:
                    preview_bytes = make_orthanc_request(preview_url, username, password)
                    b64 = resize_and_encode_image(preview_bytes, image_format, max_dimension, jpeg_quality)
                    instance_entry["imagePngBase64"] = b64
                except Exception as e:
                    print(f"Error getting preview: {e}", file=sys.stderr)
                    
        sampled_instances_data.append(instance_entry)
        
    context_lines.append(f"Sampled Instances: {len(sampled_instances_data)}")
    
    output = {
        "status": "success",
        "orthancStudyId": orthanc_study_id,
        "studyInstanceUid": study_uid,
        "studyMetadata": study_tags,
        "totalInstances": total_instances,
        "sampledInstances": len(sampled_instances_data),
        "contextText": "\n".join(context_lines),
        "instances": sampled_instances_data
    }
    
    print(json.dumps(output))

if __name__ == "__main__":
    main()
