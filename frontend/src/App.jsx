import { BrowserRouter, Routes, Route } from "react-router-dom";
import ViewerPage from "./pages/viewerPage";
import ChatPage from "./pages/ChatPage";
import Dashboard from "./pages/Dashboard";
import Modality from "./pages/Modality";
import SimulatePage from "./pages/SimulatePage";
import DicomWorklistPage from './pages/DicomWorklistPage'
import DicomViewerPage from './pages/DicomViewerPage'
import PatientViewerPage from './pages/patientViewer'
import WorklistPage from './pages/worklistPage'
import EcgForwarder from "./pages/EcgForwarder";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/post-pacs" element={<ViewerPage />} />
        <Route path="/chat-ai" element={<ChatPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/modality" element={<Modality />} />
        <Route path="/worklist-simulator" element={<SimulatePage />} />
        <Route path="/dicom-worklist" element={<DicomWorklistPage />} />
        <Route path="/dicom-viewer" element={<DicomViewerPage />} />
        <Route path="/patient-viewer" element={<PatientViewerPage />} />
        <Route path="/worklist" element={<WorklistPage />} />
        <Route path="/ecg-forwarder" element={<EcgForwarder />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
