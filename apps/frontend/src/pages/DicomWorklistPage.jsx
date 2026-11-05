import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  ArrowLeft,
  Activity,
} from 'lucide-react'

import '../styles/dicomWorklist.css'
import logo from "../assets/vismed-logo.png";

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

  const [selectedStudy, setSelectedStudy] =
    useState(studies[1])

  return (

    <div className="dw-page">

      {/* HEADER */}

      <header className="dw-top-header">

        <div className="dw-top-left">

          <div
            className="dw-back"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1)
              } else {
                navigate("/")
              }
            }}
          >
            <ArrowLeft size={20} />
          </div>

          <img
            src={logo}
            alt=""
            className="dw-logo"
          />

          <div>

            <div className="dw-top-title">
              VisMed DICOM Worklist
            </div>

            <div className="dw-top-subtitle">
              Multi-Modality Examination Workspace
            </div>

          </div>

        </div>

        <div className="dw-top-status">

          <Activity size={16} />

          Active Worklist

        </div>

      </header>

      {/* CONTENT */}

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

          {/* SCROLLABLE LIST */}

          <div className="dw-study-scroll">

            <div className="dw-study-list">

              {studies.map((study) => (

                <div
                  key={study.id}
                  className={`dw-study-card ${
                    selectedStudy.id === study.id
                      ? 'dw-active-card'
                      : ''
                  }`}
                  onClick={() =>
                    setSelectedStudy(study)
                  }
                >

                  <div className="dw-study-image">

                    <img
                      src={study.preview}
                      alt=""
                    />

                  </div>

                  <div className="dw-study-info">

                    <div className="dw-patient-section">

                      <h3>{study.patient}</h3>

                      <p>
                        ID:
                        {' '}
                        {study.patientId}
                      </p>

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

        </div>

        {/* RIGHT */}

        <div className="dw-right-panel">

          <div className="dw-right-scroll">

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

                <span>Description</span>

                <p>{selectedStudy.description}</p>

              </div>

              <div className="dw-preview-row">

                <span>Date</span>

                <p>{selectedStudy.date}</p>

              </div>

              <div className="dw-preview-row">

                <span>Time</span>

                <p>{selectedStudy.time}</p>

              </div>

              <div className="dw-preview-row">

                <span>Instances</span>

                <p>
                  {selectedStudy.images}
                  {' '}
                  DICOM Slices
                </p>

              </div>

            </div>

          </div>

          <button
            className="dw-launch-button"
            onClick={() =>
              navigate('/dicom-viewer')
            }
          >
            Launch Viewer
          </button>

        </div>

      </div>

    </div>
  )
}

export default DicomWorklistPage