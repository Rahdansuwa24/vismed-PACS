import logo from "../../../assets/vismed-logo.png";

const PatientAccessModal = ({
  patientIdInput,
  setPatientIdInput,
  handlePatientAccess,
}) => {
  return (
    <div className="pv-access-overlay">
      <div className="pv-access-modal">
        <img
          src={logo}
          alt=""
          className="pv-access-logo"
        />

        <h2>Patient Access Verification</h2>

        <p>
          Enter your Patient ID to access
          radiology examination results.
        </p>

        <input
          type="text"
          placeholder="Enter Patient ID"
          value={patientIdInput}
          onChange={(e) =>
            setPatientIdInput(e.target.value)
          }
          className="pv-access-input"
        />

        <button
          className="pv-access-button"
          onClick={handlePatientAccess}
        >
          Access Examination
        </button>

        <div className="pv-access-demo">
          <span>Demo ID</span>
          <p>884-9022-X</p>
        </div>
      </div>
    </div>
  );
};

export default PatientAccessModal;
