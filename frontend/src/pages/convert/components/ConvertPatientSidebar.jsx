const ConvertPatientSidebar = ({ patients, currentPatient, handleSelect }) => {
  return (
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
  );
};

export default ConvertPatientSidebar;
