import { ArrowLeft, Menu, X } from "lucide-react";
import logo from "../../../assets/vismed-logo.png";

const PatientViewerHeader = ({ mobileMenu, setMobileMenu, onBack }) => {
  return (
    <header className="pv-header">
      <div className="pv-header-left">
        <div
          className="pv-back"
          onClick={onBack}
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
  );
};

export default PatientViewerHeader;
