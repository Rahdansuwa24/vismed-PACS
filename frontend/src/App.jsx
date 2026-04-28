import { BrowserRouter, Routes, Route } from "react-router-dom";
import ViewerPage from "./pages/viewerPage";
import ChatPage from "./pages/ChatPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/post-pacs" element={<ViewerPage />} />
        <Route path="/chat-ai" element={<ChatPage />} /> 
      </Routes>
    </BrowserRouter>
  );
}

export default App;