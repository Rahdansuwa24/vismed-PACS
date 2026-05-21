import { useState } from 'react'
import '../styles/dicomViewer.css'

function DicomViewerPage() {
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

  const [selectedSeries, setSelectedSeries] = useState(seriesData[0])

  return (
    <div className="dv-page">
      {/* LEFT */}
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
              onClick={() => setSelectedSeries(series)}
            >
              <img src={series.image} alt="" />

              <div className="dv-series-info">
                <h3>{series.id}: {series.title}</h3>
                <p>Thickness: {series.thickness}</p>
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
      </div>

      {/* RIGHT */}
      <div className="dv-right-sidebar">
        <div className="dv-meta-title">
          METADATA
        </div>

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

        <div className="dv-measurement-box">
          <h3>Measurements</h3>

          <div className="dv-measure-item">
            L-Length 01 — 14.22 mm
          </div>

          <div className="dv-measure-item">
            L-Length 02 — 8.45 mm
          </div>
        </div>

        <button className="dv-sign-button">
          SIGN & APPROVE
        </button>
      </div>
    </div>
  )
}

export default DicomViewerPage