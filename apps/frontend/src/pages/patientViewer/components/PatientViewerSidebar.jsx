import {
  Download,
  FileText,
  ShieldCheck,
} from "lucide-react";

const PatientViewerSidebar = ({ mobileMenu, patient, patientIdInput }) => {
  return (
    <aside
      className={`pv-sidebar ${mobileMenu ? 'pv-sidebar-mobile-open' : ''
        }`}
    >
      <div className="pv-patient-card">
        <div className="pv-avatar">
          <ShieldCheck size={32} />
        </div>

        <h2>
          {patient?.patientName || "Memuat..."}
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
            {patient?.modality || "CT"} Scan
          </p>
        </div>

        <div className="pv-info-row">
          <span>Study Date</span>
          <p>
            {patient?.studyDate || "-"}
          </p>
        </div>

        <div className="pv-info-row">
          <span>Hospital</span>
          <p>
            {patient?.hospital || "-"}
          </p>
        </div>

        {/* <div className="pv-info-row">
          <span>Radiologist</span>
          <p>
            {patient?.radiologist || "Dr. Andika, Sp.Rad"}
          </p>
        </div> */}
      </div>

      <div className="pv-report-box">
        <div className="pv-report-header">
          <FileText size={18} />
          <h3>Radiology & AI Report</h3>
        </div>

        <div className="pv-report-content">
          {patient?.aiReport && (
            <div className="pv-report-section" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '18px' }}>
              <h4 style={{ color: '#00d4ff', marginBottom: '10px' }}>AI Clinical Analysis</h4>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '13px', color: '#CBD5E1', fontFamily: 'inherit' }}>
                {patient.aiReport}
              </div>
            </div>
          )}

          {patient?.onnxResult && patient.onnxResult.analyzedFiles && (
            <div className="pv-report-section">
              <h4 style={{ color: '#00d4ff' }}>Classification Findings</h4>
              {patient.onnxResult.analyzedFiles.map((file, fIdx) => (
                <div key={fIdx} style={{ marginBottom: '12px' }}>
                  <p style={{ fontFamily: 'monospace', fontSize: '10px', color: '#94A3B8', margin: '0 0 6px 0', wordBreak: 'break-all' }}>
                    {file.filename}
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '16px' }}>
                    {file.findings && file.findings.map((finding, idx) => (
                      <li key={idx} style={{ fontSize: '13px', color: '#E5E7EB', marginBottom: '4px' }}>
                        <strong>{finding.label}</strong>: <span style={{ color: '#00ffcc', fontWeight: '500' }}>{(finding.confidence * 100).toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="pv-report-section">
            {/* <h4>Radiologist</h4> */}
            <div className="pv-report-doctor">
              <div>
                {/* <strong>
                  {patient?.radiologist || "Dr. Andika, Sp.Rad"}
                </strong> */}

                {/* <span>
                  Radiology Specialist
                </span> */}
              </div>

              {/* <div className="pv-report-date">
                {patient?.studyDate}
              </div> */}
            </div>
          </div>
        </div>
      </div>

      <button className="pv-download-button" onClick={() => window.print()}>
        <Download size={18} />
        Download Result PDF
      </button>
    </aside>
  );
};

export default PatientViewerSidebar;
