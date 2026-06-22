import { ArrowLeft } from "lucide-react";
import logo from "../../../assets/vismed-logo.png";

const ConvertHeader = ({ onBack }) => {
  return (
    <header className="misv-header">
      <div className="misv-logo-area">
        <div className="misv-back" onClick={onBack}>
          <ArrowLeft size={20} />
        </div>
        <img src={logo} className="misv-logo" alt="logo" />
        <div>
          <h2 className="misv-title">VisMed Imaging System</h2>
          <div className="misv-subtitle">
            Radiology Image Review & Patient Record Assignment
          </div>
        </div>
      </div>
    </header>
  );
};

export default ConvertHeader;
