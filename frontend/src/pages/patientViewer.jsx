import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/patientViewer.css'
import PatientAccessModal from './patientViewer/components/PatientAccessModal'
import PatientViewerHeader from './patientViewer/components/PatientViewerHeader'
import PatientViewerMainContent from './patientViewer/components/PatientViewerMainContent'
import PatientViewerSidebar from './patientViewer/components/PatientViewerSidebar'

function PatientViewerPage() {
    const navigate = useNavigate()
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

    const currentPatient = patientDatabase[patientIdInput]

    const handlePatientAccess = () => {
        const patient = patientDatabase[patientIdInput]

        if (patient) {
        setIsAuthenticated(true)
        } else {
        alert('Patient ID not found')
        }
    }

    const handleBack = () => {
        if (window.history.length > 1) {
        navigate(-1)
        } else {
        navigate('/')
        }
    }

    return (
        <div className="pv-page">
        {!isAuthenticated && (
            <PatientAccessModal
            patientIdInput={patientIdInput}
            setPatientIdInput={setPatientIdInput}
            handlePatientAccess={handlePatientAccess}
            />
        )}

        <PatientViewerHeader
            mobileMenu={mobileMenu}
            setMobileMenu={setMobileMenu}
            onBack={handleBack}
        />

        <div className="pv-layout">
            <PatientViewerSidebar
            mobileMenu={mobileMenu}
            patient={currentPatient}
            patientIdInput={patientIdInput}
            />

            <PatientViewerMainContent
            patient={currentPatient}
            selectedSeries={selectedSeries}
            seriesData={seriesData}
            setSelectedSeries={setSelectedSeries}
            />
        </div>
        </div>
    )
}

export default PatientViewerPage
