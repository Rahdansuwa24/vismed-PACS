import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import axios from "axios";
import logo from "../assets/vismed-logo.png";
import "../styles/mis.css";


export default function MISViewer() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(0);
  
  useEffect(() => {
  axios.get("http://localhost:3000/pacs/get-mwl")
    .then(res => {

      console.log("MWL:", res.data);

      const mapped = res.data.map((p, i) => ({
        id: p.id + "_" + i,
        rawId: p.id,
        name: p.name,
        modality: p.modality,
        bodypart: p.bodypart,
        date: p.date,
        time: p.time,
        videos: []
      }));

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
      setCurrentVideo(updatedPatient.videos.length - 1); // ✅ gunakan state video
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
      currentPatient.date.replaceAll("-", "")
    );
    formData.append(
      "time",
      currentPatient.time.replace(":", "") + "00"
    );
  };

  const handleSave = async () => {
  if (!currentPatient) {
    alert("pilih pasien terlebih dahulu");
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

  return (
    <div className="misv-root">
      {/* HEADER */}
      <header className="misv-header">
        <div className="misv-logo-area">
          <div
            className="misv-back"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/dashboard"); // fallback aman
              }
            }}
          >
            <ArrowLeft size={20} />
          </div>
          <img
            src={logo}
            className="misv-logo"
            alt="logo"
          />
          <div>
            <h2 className="misv-title">VisMed Imaging System</h2>
            <div className="misv-subtitle">
              Radiology Image Review & Patient Record Assignment
            </div>
          </div>
        </div>
      </header>

      {/* LAYOUT */}
      <div className="misv-layout">
        {/* SIDEBAR */}
        <aside className="misv-sidebar">
          <label className="misv-section-label">Select Patient</label>

          <select
            className="misv-patient-select"
            onChange={handleSelect}
            value={currentPatient?.id || ""}
          >
            <option value="">Choose patient by ID...</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>

          {/* PATIENT CARD */}
          <div
            className="misv-patient-card"
            style={{ display: currentPatient ? "block" : "none" }}
          >
            <h6 className="misv-card-title">Incoming Image Details</h6>

            <div className="misv-info-row">
              <span>Patient Name</span>
              <strong>{currentPatient?.name}</strong>
            </div>

            <div className="misv-info-row">
              <span>Patient ID</span>
              <strong>{currentPatient?.id}</strong>
            </div>

            <div className="misv-info-row">
              <span>Modality</span>
              <span className="misv-modality">
                {currentPatient?.modality}
              </span>
            </div>

            <div className="misv-info-row">
              <span>Body Part</span>
              <strong>{currentPatient?.bodypart}</strong>
            </div>

            <div className="misv-info-row">
              <span>Date</span>
              <strong>{currentPatient?.date}</strong>
            </div>

            <div className="misv-info-row">
              <span>Time</span>
              <strong>{currentPatient?.time}</strong>
            </div>
          </div>
        </aside>

        {/* VIEWER */}
        <main className="misv-viewer-wrapper">
          <div className="misv-viewer">
          {currentPatient?.videos.length > 0 && (
            <video
              src={URL.createObjectURL(
                currentPatient.videos[currentVideo]
              )}
              className="misv-image"
              controls
              autoPlay
            />
          )}

        {/* EMPTY */}
        {currentPatient &&
          currentPatient.videos.length === 0 && (
            <div>No Data</div>
          )}
                </div>
              </main>
            </div>

      <footer className="misv-footer">
        <div className="misv-viewer-controls">
          <button className="misv-nav-btn" onClick={prev}>
            Previous
          </button>

          <span className="misv-img-count">
            Video {currentPatient ? currentVideo + 1 : 0} /{" "}
            {currentPatient ? currentPatient.videos.length : 0}
          </span>

          <button className="misv-nav-btn" onClick={next}>
            Next
          </button>
        </div>

        <label className="misv-upload-btn">
          Upload
          <input
            type="file"
            accept="video/*"
            onChange={(e) => handleUpload(e)}
            hidden
          />
        </label>

        <button className="misv-save-btn" onClick={handleSave}>
          Save to Patient Record
        </button>
      </footer>
    </div>
  );
}
