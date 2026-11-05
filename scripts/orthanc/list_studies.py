import urllib.request
import json
import base64

def make_request(url):
    req = urllib.request.Request(url)
    auth_str = "orthanc:orthanc"
    auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    req.add_header("Authorization", f"Basic {auth_b64}")
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))

def main():
    try:
        studies = make_request("http://localhost:8042/studies?expand")
        for study in studies:
            study_id = study.get("ID")
            patient_name = study.get("PatientMainDicomTags", {}).get("PatientName", "Unknown")
            patient_id = study.get("PatientMainDicomTags", {}).get("PatientID", "Unknown")
            study_desc = study.get("MainDicomTags", {}).get("StudyDescription", "Unknown")
            study_date = study.get("MainDicomTags", {}).get("StudyDate", "Unknown")
            
            # Query series to get modalities
            modalities = set()
            series_ids = study.get("Series", [])
            for s_id in series_ids:
                try:
                    s_data = make_request(f"http://localhost:8042/series/{s_id}")
                    mod = s_data.get("MainDicomTags", {}).get("Modality")
                    if mod:
                        modalities.add(mod)
                except Exception:
                    pass
            
            mods_str = ", ".join(modalities) if modalities else "Unknown"
            print(f"ID: {study_id} | Patient: {patient_name} ({patient_id}) | Desc: {study_desc} | Mods: {mods_str} | Date: {study_date}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
