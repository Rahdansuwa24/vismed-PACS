import { useState } from "react";
import "../styles/mis.css";

const patients = [
  {
    id: "P12345",
    name: "Ahmad",
    modality: "CT",
    bodypart: "Chest",
    date: "2026-03-04",
    time: "09:30 AM",
    images: [
      "https://picsum.photos/900/500?1",
      "https://picsum.photos/900/500?2",
      "https://picsum.photos/900/500?3",
    ],  
  },
  {
    id: "P43210",
    name: "Budi",
    modality: "MRI",
    bodypart: "Head",
    date: "2026-03-03",
    time: "11:20 AM",
    images: [
      "https://picsum.photos/900/500?4",
      "https://picsum.photos/900/500?5",
    ],
  },
  {
    id: "P88991",
    name: "Siti",
    modality: "X-Ray",
    bodypart: "Arm",
    date: "2026-03-02",
    time: "02:15 PM",
    images: ["https://picsum.photos/900/500?6"],
  },
];

export default function MISViewer() {
  const [currentPatient, setCurrentPatient] = useState(null);
  const [currentImage, setCurrentImage] = useState(0);

  const handleSelect = (e) => {
    const patient = patients.find((p) => p.id === e.target.value);
    if (!patient) return;
    setCurrentPatient(patient);
    setCurrentImage(0);
  };

  const handleUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const imageUrl = URL.createObjectURL(file);

  if (!currentPatient) {
    alert("Select patient first");
    return;
  }

  // tambah ke list image
  const updatedPatient = {
    ...currentPatient,
    images: [...currentPatient.images, imageUrl],
  };

  setCurrentPatient(updatedPatient);
  setCurrentImage(updatedPatient.images.length - 1);
};

  const next = () => {
    if (!currentPatient) return;
    if (currentImage < currentPatient.images.length - 1) {
      setCurrentImage((prev) => prev + 1);
    }
  };

  const prev = () => {
    if (!currentPatient) return;
    if (currentImage > 0) {
      setCurrentImage((prev) => prev - 1);
    }
  };

  const handleSave = () => {
    if (!currentPatient) {
      alert("Select patient first");
      return;
    }

    const payload = {
      patientID: currentPatient.id,
      modality: currentPatient.modality,
      bodypart: currentPatient.bodypart,
      date: currentPatient.date,
      image: currentPatient.images[currentImage],
    };

    console.log("Save Record Payload:", payload);
    alert("Image assigned to patient medical record");
  };

  return (
    <div>
      {/* HEADER */}
      <header className="header">
        <div className="logo-area">
          <img
            src="/logo-app/vismed-logo.png"
            className="logo"
            alt="logo"
          />
          <div>
            <div className="title">VISMED Imaging System</div>
            <div className="subtitle">
              Radiology Image Review & Patient Record Assignment
            </div>
          </div>
        </div>
      </header>

      {/* LAYOUT */}
      <div className="layout">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <label className="section-label">Select Patient</label>

          <select
            className="patient-select"
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
            className="patient-card"
            style={{ display: currentPatient ? "block" : "none" }}
          >
            <h6 className="card-title">Incoming Image Details</h6>

            <div className="info-row">
              <span>Patient Name</span>
              <strong>{currentPatient?.name}</strong>
            </div>

            <div className="info-row">
              <span>Patient ID</span>
              <strong>{currentPatient?.id}</strong>
            </div>

            <div className="info-row">
              <span>Modality</span>
              <span className="modality">
                {currentPatient?.modality}
              </span>
            </div>

            <div className="info-row">
              <span>Body Part</span>
              <strong>{currentPatient?.bodypart}</strong>
            </div>

            <div className="info-row">
              <span>Date</span>
              <strong>{currentPatient?.date}</strong>
            </div>

            <div className="info-row">
              <span>Time</span>
              <strong>{currentPatient?.time}</strong>
            </div>
          </div>
        </aside>

        {/* VIEWER */}
        <main className="viewer-wrapper">
          <div className="viewer">
            {currentPatient ? (
              <img
                src={currentPatient.images[currentImage]}
                alt="viewer"
              />
            ) : (
              <div className="viewer-placeholder">
                No Image Loaded
              </div>
            )}
          </div>
        </main>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="viewer-controls">
          <button className="nav-btn" onClick={prev}>
            Previous
          </button>

          <span className="img-count">
            Image {currentPatient ? currentImage + 1 : 0} /{" "}
            {currentPatient ? currentPatient.images.length : 0}
          </span>

          <button className="nav-btn" onClick={next}>
            Next
          </button>
        </div>

        <label className="upload-btn">
      Upload
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleUpload(e)}
          hidden
        />
      </label>

        <button className="save-btn" onClick={handleSave}>
          Save to Patient Record
        </button>
      </footer>
    </div>
  );
}