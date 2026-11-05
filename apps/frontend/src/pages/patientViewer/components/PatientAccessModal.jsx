import logo from "../../../assets/vismed-logo.png";

const PatientAccessModal = ({
  patientIdInput,
  setPatientIdInput,
  handlePatientAccess,
  isLoading,
  error
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

        {error && <div className="pv-access-error">{error}</div>}

        {isLoading ? (
          <div className="pv-loading-container">
            <div className="pv-spinner"></div>
            <p style={{ color: '#00ffcc', fontWeight: 500, margin: '12px 0 0 0', fontSize: '14px' }}>
              Memuat dan mendekode citra PACS...
            </p>
          </div>
        ) : (
          <>
            <input
              type="text"
              placeholder="Enter Patient ID"
              value={patientIdInput}
              onChange={(e) =>
                setPatientIdInput(e.target.value)
              }
              className="pv-access-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePatientAccess();
              }}
            />

            <button
              className="pv-access-button"
              onClick={handlePatientAccess}
            >
              Access Examination
            </button>
          </>
        )}

        <div className="pv-access-demo">
          <span>Demo ID (Orthanc PACS)</span>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '6px' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>US (OLGA AYU)</span>
              <p style={{ margin: '2px 0 0 0', color: '#00ffcc', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }} onClick={() => setPatientIdInput('685420')}>685420</p>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>CT (Lung/PET)</span>
              <p style={{ margin: '2px 0 0 0', color: '#00d4ff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }} onClick={() => setPatientIdInput('TCGA-50-6592')}>TCGA-50-6592</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientAccessModal;
