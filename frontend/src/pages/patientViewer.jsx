import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import '../styles/patientViewer.css'
import PatientAccessModal from './patientViewer/components/PatientAccessModal'
import PatientViewerHeader from './patientViewer/components/PatientViewerHeader'
import PatientViewerMainContent from './patientViewer/components/PatientViewerMainContent'
import PatientViewerSidebar from './patientViewer/components/PatientViewerSidebar'

function formatDicomDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.substring(0, 4);
    const monthStr = dateStr.substring(4, 6);
    const dayStr = dateStr.substring(6, 8);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIdx = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);
    if (isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return dateStr;
    return `${day} ${months[monthIdx]} ${year}`;
}

function PatientViewerPage() {
    const navigate = useNavigate()
    const [mobileMenu, setMobileMenu] = useState(false)
    const [patientIdInput, setPatientIdInput] = useState('')
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    
    // Live PACS data states
    const [patientData, setPatientData] = useState(null)
    const [seriesList, setSeriesList] = useState([])
    const [selectedSeries, setSelectedSeries] = useState(null)
    const [currentInstanceIndex, setCurrentInstanceIndex] = useState(0)
    
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)

    const handlePatientAccess = async () => {
        if (!patientIdInput.trim()) {
            alert('Masukkan Patient ID terlebih dahulu');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get(`http://localhost:3000/pacs/patient-view?patientID=${encodeURIComponent(patientIdInput.trim())}`);
            const data = response.data;
            
            const study = data.study;
            const analysis = data.analysis;
            const decodedStudy = analysis?.decodedStudy || {};
            const instances = decodedStudy.instances || [];

            // Extract tags
            const ptTags = study.PatientMainDicomTags || {};
            const stTags = study.MainDicomTags || {};

            const fetchedPatient = {
                patientName: ptTags.PatientName || decodedStudy.studyMetadata?.PatientName || 'Unknown Patient',
                patientID: ptTags.PatientID || decodedStudy.studyMetadata?.PatientID || patientIdInput,
                modality: stTags.Modality || decodedStudy.studyMetadata?.Modality || 'CT',
                studyDate: stTags.StudyDate ? formatDicomDate(stTags.StudyDate) : (decodedStudy.studyMetadata?.StudyDate ? formatDicomDate(decodedStudy.studyMetadata?.StudyDate) : 'Unknown Date'),
                hospital: study.MainDicomTags?.InstitutionName || decodedStudy.studyMetadata?.InstitutionName || 'RSI Surabaya',
                radiologist: study.MainDicomTags?.ReferringPhysicianName || 'Dr. Andika, Sp.Rad',
                findings: analysis?.findings || analysis?.aiResponse?.findings || 'Findings not available.',
                impression: analysis?.impression || analysis?.aiResponse?.impression || 'Impression not available.',
                summary: analysis?.summary || analysis?.aiResponse?.summary || 'Summary not available.',
                aiReport: analysis?.aiResponse?.response || null,
                onnxResult: analysis?.onnxResult
            };

            // Group instances by SeriesDescription
            const instancesBySeries = {};
            instances.forEach(inst => {
                const seriesDesc = inst.metadata?.SeriesDescription || "Series 1";
                if (!instancesBySeries[seriesDesc]) {
                    instancesBySeries[seriesDesc] = [];
                }
                instancesBySeries[seriesDesc].push(inst);
            });

            // Map grouped instances to series list format
            let processedSeries = Object.keys(instancesBySeries).map((seriesName, idx) => {
                const seriesInstances = instancesBySeries[seriesName];
                seriesInstances.sort((a, b) => (a.index || 0) - (b.index || 0));
                
                return {
                    id: idx + 1,
                    title: seriesName,
                    description: seriesInstances[0]?.metadata?.BodyPartExamined || stTags.StudyDescription || "Pemeriksaan Radiologi",
                    images: seriesInstances.length,
                    image: `data:image/png;base64,${seriesInstances[0]?.imagePngBase64}`,
                    instances: seriesInstances
                };
            });

            // Fallback if no instances returned from decode server
            if (processedSeries.length === 0) {
                processedSeries = [
                    {
                        id: 1,
                        title: 'No Images Available',
                        description: 'Citra DICOM tidak dapat didecode oleh server.',
                        images: 0,
                        image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?q=80&w=1200&auto=format&fit=crop',
                        instances: []
                    }
                ];
            }

            setPatientData(fetchedPatient);
            setSeriesList(processedSeries);
            setSelectedSeries(processedSeries[0]);
            setCurrentInstanceIndex(0);
            setIsAuthenticated(true);
        } catch (err) {
            console.error("Gagal verifikasi rekam medis:", err);
            setError(err.response?.data?.error || err.message || "Gagal memuat rekam medis");
        } finally {
            setIsLoading(false);
        }
    };

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
                    isLoading={isLoading}
                    error={error}
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
                    patient={patientData}
                    patientIdInput={patientIdInput}
                />

                {selectedSeries && (
                    <PatientViewerMainContent
                        patient={patientData}
                        selectedSeries={selectedSeries}
                        seriesData={seriesList}
                        setSelectedSeries={(series) => {
                            setSelectedSeries(series);
                            setCurrentInstanceIndex(0);
                        }}
                        currentInstanceIndex={currentInstanceIndex}
                        setCurrentInstanceIndex={setCurrentInstanceIndex}
                    />
                )}
            </div>
        </div>
    )
}

export default PatientViewerPage
