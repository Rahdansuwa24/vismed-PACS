import {
  Download,
  FileText,
  ShieldCheck,
} from "lucide-react";

const PatientViewerSidebar = ({ mobileMenu, patient, patientIdInput }) => {
  return (
    <aside
      className={`pv-sidebar ${
        mobileMenu ? 'pv-sidebar-mobile-open' : ''
      }`}
    >
      <div className="pv-patient-card">
        <div className="pv-avatar">
          <ShieldCheck size={32} />
        </div>

        <h2>
          {patient?.patientName}
        </h2>

        <p>Patient ID: {patientIdInput}</p>

        <div className="pv-status">
          READ ONLY MODE
        </div>
      </div>

      <div className="pv-study-info">
        <h3>Study Information</h3>

        <div className="pv-info-row">
          <span>Modality</span>
          <p>
            {patient?.modality}{' '}
            Scan
          </p>
        </div>

        <div className="pv-info-row">
          <span>Study Date</span>
          <p>
            {patient?.studyDate}
          </p>
        </div>

        <div className="pv-info-row">
          <span>Hospital</span>
          <p>
            {patient?.hospital}
          </p>
        </div>

        <div className="pv-info-row">
          <span>Radiologist</span>
          <p>
            {patient?.radiologist}
          </p>
        </div>
      </div>

      <div className="pv-report-box">
        <div className="pv-report-header">
          <FileText size={18} />
          <h3>Radiology Report</h3>
        </div>

        <div className="pv-report-content">
          <div className="pv-report-section">
            <h4>Clinical Information</h4>
            <p>
              Patient presented with chest
              discomfort, persistent cough,
              and mild shortness of breath.
            </p>
          </div>

          <div className="pv-report-section">
            <h4>Findings</h4>
            <p>
              CT examination of the thorax
              demonstrates mild inflammatory
              infiltrates within the right
              upper lobe. No pleural effusion
              or pneumothorax identified.
              Cardiomediastinal silhouette
              appears within normal limits.
            </p>

            <p>
              No evidence of pulmonary
              embolism or acute thoracic
              abnormality.
            </p>
          </div>

          <div className="pv-report-section">
            <h4>Impression</h4>
            <ul>
              <li>
                Mild inflammatory changes in
                right upper lobe.
              </li>

              <li>
                No acute pulmonary
                abnormality.
              </li>

              <li>
                Recommend clinical
                correlation.
              </li>
            </ul>
          </div>

          <div className="pv-report-section">
            <h4>Radiologist</h4>
            <div className="pv-report-doctor">
              <div>
                <strong>
                  {patient?.radiologist}
                </strong>

                <span>
                  Radiology Specialist
                </span>
              </div>

              <div className="pv-report-date">
                {patient?.studyDate}
              </div>
            </div>
          </div>
        </div>
      </div>

      <button className="pv-download-button">
        <Download size={18} />
        Download Result PDF
      </button>
    </aside>
  );
};

export default PatientViewerSidebar;
