import { BrowserRouter, Routes, Route } from "react-router-dom";
import ConvertPage from "./pages/ConvertPage";
import ChatPage from "./pages/ChatPage";
import Dashboard from "./pages/Dashboard";
import Modality from "./pages/Modality";
import SimulatePage from "./pages/SimulatePage";
import DicomWorklistPage from './pages/DicomWorklistPage'
import DicomViewerPage from './pages/DicomViewerPage'
import PatientViewerPage from './pages/patientViewer'
import RadiologyWorklistPage from './pages/worklist/RadiologyWorklistPage'
import PolyclinicWorklistPage from './pages/worklist/PolyclinicWorklistPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/post-pacs" element={<ConvertPage />} />
        <Route path="/chat-ai" element={<ChatPage />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/modality" element={<Modality />} />
        <Route path="/worklist-simulator" element={<SimulatePage />} />
        <Route path="/dicom-worklist" element={<DicomWorklistPage />} />
        <Route path="/dicom-viewer" element={<DicomViewerPage />} />
        <Route path="/patient-viewer" element={<PatientViewerPage />} />
        <Route path="/worklist" element={<RadiologyWorklistPage />} />
        <Route path="/worklist-radiology" element={<RadiologyWorklistPage />} />
        <Route path="/worklist-polyclinic" element={<PolyclinicWorklistPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
