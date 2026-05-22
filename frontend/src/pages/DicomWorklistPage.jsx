import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import '../styles/dicomWorklist.css'

function DicomWorklistPage() {
  const navigate = useNavigate()

  const studies = [
    {
      id: 1,
      patient: 'DOE, JOHN',
      patientId: '884-9022-X',
      modality: 'CT - Siemens',
      description: 'Chest w/ Contrast',
      date: '2025-05-20',
      time: '14:22',
      images: 142,
      status: 'COMPLETE',
      preview:
        'https://images.unsplash.com/photo-1581595219315-a187dd40c322?q=80&w=1200&auto=format&fit=crop',
    },
    {
      id: 2,
      patient: 'SMITH, ALICE',
      patientId: '112-4456-B',
      modality: 'MRI - GE',
      description: 'Brain w/o Contrast',
      date: '2025-05-20',
      time: '13:05',
      images: 284,
      status: 'COMPLETE',
      preview:
        'https://images.unsplash.com/photo-1579154204601-01588f351e67?q=80&w=1200&auto=format&fit=crop',
    },
    {
      id: 3,
      patient: 'MILLER, ROBERT',
      patientId: '556-2110-C',
      modality: 'DX - Philips',
      description: 'Chest PA/Lateral',
      date: '2025-05-20',
      time: '11:40',
      images: 2,
      status: 'COMPLETE',
      preview:
        'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?q=80&w=1200&auto=format&fit=crop',
    },
  ]

  const [selectedStudy, setSelectedStudy] = useState(studies[1])

  return (
    <div className="dw-page">
      <div className="dw-container">
        {/* LEFT */}
        <div className="dw-left-panel">
          <div className="dw-header">
            <h1>Study Worklist</h1>

            <div className="dw-filter-group">
              <select className="dw-select">
                <option>All Modalities</option>
                <option>CT</option>
                <option>MRI</option>
                <option>DX</option>
              </select>

              <select className="dw-select">
                <option>Today</option>
                <option>Yesterday</option>
                <option>This Week</option>
              </select>
            </div>
          </div>

          <div className="dw-study-list">
            {studies.map((study) => (
              <div
                key={study.id}
                className={`dw-study-card ${
                  selectedStudy.id === study.id ? 'dw-active-card' : ''
                }`}
                onClick={() => setSelectedStudy(study)}
              >
                <div className="dw-study-image">
                  <img src={study.preview} alt="" />
                </div>

                <div className="dw-study-info">
                  <div className="dw-patient-section">
                    <h3>{study.patient}</h3>
                    <p>ID: {study.patientId}</p>
                  </div>

                  <div className="dw-modality-section">
                    <span>MODALITY</span>
                    <h4>{study.modality}</h4>
                  </div>

                  <div className="dw-description-section">
                    <span>DESCRIPTION</span>
                    <h4>{study.description}</h4>
                  </div>

                  <div className="dw-meta-section">
                    <div>
                      <p>{study.date}</p>
                      <p>{study.time}</p>
                    </div>

                    <div className="dw-images-count">
                      {study.images} IMGS
                    </div>

                    <div className="dw-status">
                      {study.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="dw-right-panel">
          <div className="dw-preview-header">
            <h2>Study Preview</h2>
          </div>

          <div className="dw-preview-image-container">
            <img
              src={selectedStudy.preview}
              alt=""
              className="dw-preview-image"
            />
          </div>

          <div className="dw-preview-info">
            <div className="dw-preview-row">
              <span>Patient</span>
              <p>{selectedStudy.patient}</p>
            </div>

            <div className="dw-preview-row">
              <span>Patient ID</span>
              <p>{selectedStudy.patientId}</p>
            </div>

            <div className="dw-preview-row">
              <span>Modality</span>
              <p>{selectedStudy.modality}</p>
            </div>

            <div className="dw-preview-row">
              <span>Instances</span>
              <p>{selectedStudy.images} DICOM Slices</p>
            </div>
          </div>

          <button
            className="dw-launch-button"
            onClick={() => navigate('/dicom-viewer')}
          >
            Launch Viewer
          </button>
        </div>
      </div>
    </div>
  )
}

export default DicomWorklistPage