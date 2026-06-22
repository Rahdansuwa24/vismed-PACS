import { ArrowLeft } from "lucide-react";
import logo from "../../../assets/vismed-logo.png";

const SimulateHeader = ({ onBack }) => {
  return (
    <header className="sim-header">
      <div className="sim-header-left">
        <button className="sim-icon-button" onClick={onBack} type="button">
          <ArrowLeft size={20} />
        </button>
        <img src={logo} className="sim-logo" alt="VisMed" />
        <div>
          <div className="sim-title">Simulasi DICOM MWL</div>
          <div className="sim-subtitle">Kirim metadata pasien ke bridge untuk dibuat menjadi worklist .wl</div>
        </div>
      </div>
    </header>
  );
};

export default SimulateHeader;
