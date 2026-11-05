import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'

import '../styles/dicomViewer.css'
import logo from "../assets/vismed-logo.png";

function DicomViewerPage() {

  const navigate = useNavigate()

  const seriesData = [
    {
      id: 1,
      title: 'Axial CT Chest',
      thickness: '1.0mm',
      images: 124,
      image:
        'https://images.unsplash.com/photo-1581595219315-a187dd40c322?q=80&w=1200&auto=format&fit=crop',
    },

    {
      id: 2,
      title: 'Sagittal Reconstruction',
      thickness: '2.5mm',
      images: 88,
      image:
        'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?q=80&w=1200&auto=format&fit=crop',
    },

    {
      id: 3,
      title: 'Coronal Soft Tissue',
      thickness: '3.0mm',
      images: 120,
      image:
        'https://images.unsplash.com/photo-1579154204601-01588f351e67?q=80&w=1200&auto=format&fit=crop',
    },
  ]

  const [selectedSeries, setSelectedSeries] =
    useState(seriesData[0])

  return (

    <div className="dv-page">

      {/* HEADER */}

      <header className="dv-header">

        <div className="dv-header-left">

          <div
            className="dv-back"
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
            alt="logo"
            className="dv-logo"
          />

          <div>

            <div className="dv-title">
              VisMed DICOM Viewer
            </div>

            <div className="dv-subtitle">
              Advanced Medical Imaging Workspace
            </div>

          </div>

        </div>

        <div className="dv-header-status">

          <span className="dv-status-dot"></span>

          Viewer Active

        </div>

      </header>

      {/* LAYOUT */}

      <div className="dv-layout">

        {/* LEFT SIDEBAR */}

        <div className="dv-left-sidebar">

          <div className="dv-sidebar-title">
            SERIES SELECTION
          </div>

          <div className="dv-series-list">

            {seriesData.map((series) => (

              <div
                key={series.id}
                className={`dv-series-card ${
                  selectedSeries.id === series.id
                    ? 'dv-series-active'
                    : ''
                }`}
                onClick={() =>
                  setSelectedSeries(series)
                }
              >

                <img
                  src={series.image}
                  alt=""
                />

                <div className="dv-series-info">

                  <h3>
                    {series.id}: {series.title}
                  </h3>

                  <p>
                    Thickness:
                    {' '}
                    {series.thickness}
                  </p>

                </div>

                <div className="dv-series-count">
                  {series.images}
                </div>

              </div>

            ))}

          </div>

        </div>

        {/* CENTER */}

        <div className="dv-main-viewer">

          <img
            src={selectedSeries.image}
            alt=""
            className="dv-main-image"
          />

          <div className="dv-viewer-overlay">

            <div>

              <p>Patient: John Doe</p>

              <p>Modality: CT</p>

            </div>

            <div>

              <p>
                Series:
                {' '}
                {selectedSeries.title}
              </p>

              <p>
                Images:
                {' '}
                {selectedSeries.images}
              </p>

            </div>

          </div>

        </div>

        {/* RIGHT SIDEBAR */}

        <div className="dv-right-sidebar">

          <div className="dv-meta-title">
            METADATA
          </div>

          {/* INFO */}

          <div className="dv-info-box">

            <span>Modality</span>
            <p>CT</p>

            <span>Study ID</span>
            <p>88231</p>

            <span>Accession</span>
            <p>ACC-9920</p>

            <span>Instances</span>
            <p>332</p>

          </div>

          {/* MEASUREMENTS */}

          <div className="dv-measurement-box">

            <h3>
              Measurements
            </h3>

            <div className="dv-measure-item">
              L-Length 01 — 14.22 mm
            </div>

            <div className="dv-measure-item">
              L-Length 02 — 8.45 mm
            </div>

          </div>

          {/* BUTTON */}

          <button className="dv-sign-button">

            SIGN & APPROVE

          </button>

        </div>

      </div>

    </div>
  )
}

export default DicomViewerPage