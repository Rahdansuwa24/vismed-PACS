import { BrowserRouter, Routes, Route } from "react-router-dom";
import ViewerPage from "./pages/viewerPage";
import ChatPage from "./pages/ChatPage";
import Dashboard from "./pages/Dashboard";
import Modality from "./pages/Modality";
import SimulatePage from "./pages/SimulatePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/post-pacs" element={<ViewerPage />} />
        <Route path="/chat-ai" element={<ChatPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/modality" element={<Modality />} />
        <Route path="/worklist-simulator" element={<SimulatePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
