import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/mis.css";
import ConvertFooter from "./convert/components/ConvertFooter";
import ConvertHeader from "./convert/components/ConvertHeader";
import ConvertPatientSidebar from "./convert/components/ConvertPatientSidebar";
import ConvertVideoViewer from "./convert/components/ConvertVideoViewer";


export default function ConvertPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(0);

  const getValue = (...values) => {
    const value = values.find((item) => item !== undefined && item !== null && item !== "");
    return value === undefined ? "" : String(value);
  };

  const formatDateForDicom = (value) => getValue(value).replaceAll("-", "");

  const formatTimeForDicom = (value) => {
    const cleanTime = getValue(value).replaceAll(":", "").replaceAll(".", "");

    if (!cleanTime) {
      return "";
    }

    return cleanTime.padEnd(6, "0").slice(0, 6);
  };
  
  useEffect(() => {
  axios.get("http://localhost:3000/pacs/get-mwl")
    .then(res => {

      console.log("MWL:", res.data);

      const mapped = res.data.map((p, i) => {
        const rawId = getValue(p.id, p.patientID, p.PatientID, i);

        return {
          id: `${rawId}_${i}`,
          rawId,
          name: getValue(p.name, p.PatientName),
          modality: getValue(p.modality, p.Modality),
          bodypart: getValue(p.bodypart, p.BodyPartExamined),
          date: getValue(p.date, p.StudyDate, p.ScheduledProcedureStepStartDate),
          time: getValue(p.time, p.StudyTime, p.ScheduledProcedureStepStartTime),
          videos: []
        };
      });

      setPatients(mapped);

    })
    .catch(err => console.error("ERROR:", err));
}, []);

  const handleSelect = (e) => {
    const patient = patients.find((p) => p.id === e.target.value);
    if (!patient) return;
    setCurrentPatient(patient);
    setCurrentVideo(0);
  };

  const handleUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (!currentPatient) {
      alert("Silahkan pilih pasien terlebih dahulu");
      return;
    }
    const videoFiles = files.filter((file) =>
      file.type.startsWith("video/")
    );

    const updatedPatient = {
      ...currentPatient,
      videos: [...currentPatient.videos, ...videoFiles]
    };

    setCurrentPatient(updatedPatient);

    setPatients((prev) =>
      prev.map((p) =>
        p.id === updatedPatient.id ? updatedPatient : p
      )
    );

    if (videoFiles.length > 0) {
      setCurrentVideo(updatedPatient.videos.length - 1); 
    }

    e.target.value = null; 
    
  };

  const next = () => {
    if (!currentPatient) return;
    if (currentVideo < currentPatient.videos.length - 1) {
      setCurrentVideo((prev) => prev + 1);
    }
  };

  const prev = () => {
    if (!currentPatient) return;
    if (currentVideo > 0) {
      setCurrentVideo((prev) => prev - 1);
    }
  };
  //Helper
  const appendMetadata = (formData) => {
    formData.append("patientID", currentPatient.rawId);
    formData.append(
      "name",
      currentPatient.name.replace(/ /g, "^")
    );
    formData.append("modality", currentPatient.modality);
    formData.append("bodypart", currentPatient.bodypart);
    formData.append(
      "date",
      formatDateForDicom(currentPatient.date)
    );
    formData.append(
      "time",
      formatTimeForDicom(currentPatient.time)
    );
  };

  const getMissingMetadata = () => {
    const metadata = {
      patientID: currentPatient?.rawId,
      name: currentPatient?.name,
      modality: currentPatient?.modality,
      bodypart: currentPatient?.bodypart,
      date: formatDateForDicom(currentPatient?.date),
      time: formatTimeForDicom(currentPatient?.time),
    };

    return Object.entries(metadata)
      .filter(([, value]) => !getValue(value))
      .map(([key]) => key);
  };

  const handleSave = async () => {
  if (!currentPatient) {
    alert("pilih pasien terlebih dahulu");
    return;
  }

  if (!currentPatient.videos.length) {
    alert("Upload video terlebih dahulu");
    return;
  }

  const missingMetadata = getMissingMetadata();

  if (missingMetadata.length) {
    alert(`Metadata pasien belum lengkap: ${missingMetadata.join(", ")}`);
    return;
  }

  try {
      for (const video of currentPatient.videos) {
        const formData = new FormData();
        formData.append("video", video);
        appendMetadata(formData);

        await axios.post(
          "http://localhost:3000/pacs/upload-videos",
          formData
        );
      }
      setCurrentPatient(null);
      setCurrentVideo(0);

      setPatients((prev) =>
      prev.map((p) => ({
        ...p,
        videos: [],
      }))
    );
      alert("Berhasil kirim ke PACS");
    } catch (err) {
      console.error(err);
      alert("Upload gagal");
    }
};

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="misv-root">
      <ConvertHeader onBack={handleBack} />

      <div className="misv-layout">
        <ConvertPatientSidebar
          patients={patients}
          currentPatient={currentPatient}
          handleSelect={handleSelect}
        />
        <ConvertVideoViewer currentPatient={currentPatient} currentVideo={currentVideo} />
      </div>

      <ConvertFooter
        currentPatient={currentPatient}
        currentVideo={currentVideo}
        handleUpload={handleUpload}
        handleSave={handleSave}
        next={next}
        prev={prev}
      />
    </div>
  );
}
