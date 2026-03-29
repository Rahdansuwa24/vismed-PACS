import { BrowserRouter, Routes, Route } from "react-router-dom";
import ViewerPage from "./pages/viewerPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/post-pacs" element={<ViewerPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;