import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
    Menu,
    X,
    FileText,
    Download,
    Image as ImageIcon,
    ShieldCheck,
    } from 'lucide-react'

    import logo from '../assets/vismed-logo.png'
    import '../styles/patientViewer.css'

    function PatientViewerPage() {
    const patientDatabase = {
        '884-9022-X': {
        patientName: 'John Doe',
        modality: 'CT',
        studyDate: '20 May 2025',
        hospital: 'RSI Surabaya',
        radiologist: 'Dr. Andika, Sp.Rad',
        },
        '991-AB22-Z': {
        patientName: 'Sarah Smith',
        modality: 'MRI',
        studyDate: '18 May 2025',
        hospital: 'RSI Surabaya',
        radiologist: 'Dr. Budi, Sp.Rad',
        },
    }

    const seriesData = [
        {
        id: 1,
        title: 'CT Chest Axial',
        description: 'Primary Chest Examination',
        images: 124,
        image:
            'https://images.unsplash.com/photo-1581595219315-a187dd40c322?q=80&w=1200&auto=format&fit=crop',
        },
        {
        id: 2,
        title: 'Sagittal Reconstruction',
        description: 'Secondary Reconstruction',
        images: 88,
        image:
            'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?q=80&w=1200&auto=format&fit=crop',
        },
        {
        id: 3,
        title: 'Coronal Soft Tissue',
        description: 'Soft Tissue Analysis',
        images: 120,
        image:
            'https://images.unsplash.com/photo-1579154204601-01588f351e67?q=80&w=1200&auto=format&fit=crop',
        },
    ]

    const [selectedSeries, setSelectedSeries] = useState(seriesData[0])
    const [mobileMenu, setMobileMenu] = useState(false)
    const [patientIdInput, setPatientIdInput] = useState('')
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    const handlePatientAccess = () => {
        const patient = patientDatabase[patientIdInput]

        if (patient) {
        setIsAuthenticated(true)
        } else {
        alert('Patient ID not found')
        }
    }

    return (
        <div className="pv-page">
        {/* ACCESS MODAL */}
        {!isAuthenticated && (
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
        )}

        {/* HEADER */}
        <header className="pv-header">
            <div className="pv-header-left">
            <div
                className="pv-back"
                onClick={() => {
                if (window.history.length > 1) {
                    navigate(-1)
                } else {
                    navigate('/dashboard')
                }
                }}
            >
                <ArrowLeft size={20} />
            </div>

            <div className="pv-brand-box">
                <img
                src={logo}
                alt="VISMED Logo"
                className="pv-brand-logo"
                />

                <div className="pv-brand-text">
                <h2>VisMed Patient Viewer</h2>
                <p>Patient Examination Results</p>
                </div>
            </div>
            </div>

            <button
            className="pv-mobile-toggle"
            onClick={() =>
                setMobileMenu(!mobileMenu)
            }
            >
            {mobileMenu ? <X /> : <Menu />}
            </button>
        </header>

        <div className="pv-layout">
            {/* SIDEBAR */}
            <aside
            className={`pv-sidebar ${
                mobileMenu ? 'pv-sidebar-mobile-open' : ''
            }`}
            >
            {/* PATIENT CARD */}
            <div className="pv-patient-card">
                <div className="pv-avatar">
                <ShieldCheck size={32} />
                </div>

                <h2>
                {patientDatabase[patientIdInput]
                    ?.patientName}
                </h2>

                <p>Patient ID: {patientIdInput}</p>

                <div className="pv-status">
                READ ONLY MODE
                </div>
            </div>

            {/* STUDY INFO */}
            <div className="pv-study-info">
                <h3>Study Information</h3>

                <div className="pv-info-row">
                <span>Modality</span>
                <p>
                    {patientDatabase[patientIdInput]
                    ?.modality}{' '}
                    Scan
                </p>
                </div>

                <div className="pv-info-row">
                <span>Study Date</span>
                <p>
                    {patientDatabase[patientIdInput]
                    ?.studyDate}
                </p>
                </div>

                <div className="pv-info-row">
                <span>Hospital</span>
                <p>
                    {patientDatabase[patientIdInput]
                    ?.hospital}
                </p>
                </div>

                <div className="pv-info-row">
                <span>Radiologist</span>
                <p>
                    {patientDatabase[patientIdInput]
                    ?.radiologist}
                </p>
                </div>
            </div>

            {/* REPORT */}
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
                        {patientDatabase[
                            patientIdInput
                        ]?.radiologist}
                        </strong>

                        <span>
                        Radiology Specialist
                        </span>
                    </div>

                    <div className="pv-report-date">
                        {patientDatabase[
                        patientIdInput
                        ]?.studyDate}
                    </div>
                    </div>
                </div>
                </div>
            </div>

            {/* DOWNLOAD */}
            <button className="pv-download-button">
                <Download size={18} />
                Download Result PDF
            </button>
            </aside>

            {/* MAIN CONTENT */}
            <main className="pv-main-content">
            {/* VIEWER */}
            <div className="pv-viewer-container">
                <img
                src={selectedSeries.image}
                alt=""
                className="pv-main-image"
                />
                <div className="pv-overlay">
                <div>
                    <p>
                    Patient:
                    {patientDatabase[patientIdInput]
                        ?.patientName}
                    </p>
                    <p>
                    Modality:
                    {patientDatabase[patientIdInput]
                        ?.modality}
                    </p>
                </div>
                <div>
                    <p>
                    Series:
                    {selectedSeries.title}
                    </p>
                    <p>
                    Images:
                    {selectedSeries.images}
                    </p>
                </div>
                </div>
            </div>
            {/* SERIES */}
            <div className="pv-series-section">
                <div className="pv-series-header">
                <ImageIcon size={20} />
                <h3>
                    Available Series
                </h3>
                </div>
                <div className="pv-series-grid">
                {seriesData.map((series) => (
                    <div
                    key={series.id}
                    className={`pv-series-card ${
                        selectedSeries.id ===
                        series.id
                        ? 'pv-series-active'
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
                    <div className="pv-series-content">
                        <h4>
                        {series.title}
                        </h4>
                        <p>
                        {series.description}
                        </p>
                        <span>
                        {series.images} Images
                        </span>
                    </div>
                    </div>
                ))}
                </div>
            </div>
            </main>

        </div>

        </div>
    )
}

export default PatientViewerPage