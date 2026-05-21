import { BrowserRouter, Routes, Route } from "react-router-dom";
import ViewerPage from "./pages/viewerPage";
import ChatPage from "./pages/ChatPage";
import Dashboard from "./pages/Dashboard";
import Modality from "./pages/Modality";
import DicomWorklistPage from './pages/DicomWorklistPage'
import DicomViewerPage from './pages/DicomViewerPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/post-pacs" element={<ViewerPage />} />
        <Route path="/chat-ai" element={<ChatPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/modality" element={<Modality />} />
        <Route path="/dicom-wl" element={<DicomWorklistPage />} />
        <Route path="/dicom-viewer" element={<DicomViewerPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;