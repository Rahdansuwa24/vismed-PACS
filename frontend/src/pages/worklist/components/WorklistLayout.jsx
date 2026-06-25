import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../../styles/worklist.css";
import logo from "../../../assets/vismed-logo.png";

import {
  FaArrowLeft,
  FaHome,
  FaClipboardList,
  FaUserMd,
  FaFlask,
  FaBoxes,
  FaCheckCircle,
  FaChartBar,
  FaCog,
  FaUser,
  FaCheck,
  FaEdit,
  FaFileExcel,
  FaSyncAlt,
  FaFilter,
  FaTimes,
  FaUserCog,
  FaBars,
} from "react-icons/fa";

const WorklistLayout = ({ 
  title = "Technologist", 
  children,
  onSelectClick,
  isSelectActive,
  onSaveProcess,
  selectedPatient,
  onProcessClick
}) => {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState(() => {
    const path = window.location.pathname;
    if (path === "/worklist-simulator") return "register";
    if (path === "/worklist-radiology") return "admission";
    if (path === "/") return "home";
    return "";
  });
  const [rightMenu, setRightMenu] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);

  const [technologist1, setTechnologist1] = useState("Radiographer 1");
  const [technologist2, setTechnologist2] = useState("Select Technologist");
  const [room, setRoom] = useState("Ruangan DR");

  const [modality, setModality] = useState("CT");
  const [aet, setAet] = useState("MODALITY1");
  const [radiologist, setRadiologist] = useState("dr. Andi, Sp.Rad");

  useEffect(() => {
    if (selectedPatient) {
      setModality(selectedPatient.modality || "CT");
      setAet(selectedPatient.aet || "MODALITY1");
      setRadiologist(selectedPatient.radiologist && selectedPatient.radiologist !== "-" ? selectedPatient.radiologist : "dr. Andi, Sp.Rad");
    }
  }, [selectedPatient]);

  return (
    <div className="genesysris-page">
      <aside className="genesysris-leftbar">
        <div className="genesysris-brand">
          <button
            type="button"
            className="genesysris-back-btn"
            aria-label="Back"
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft />
          </button>
 
          <div className="genesysris-brand-logo">
            <img src={logo} alt="logo" className="genesysris-brand-imglogo" />
          </div>

          <div className="genesysris-brand-content">
            <h2>VisMed</h2>
            <span>Radiology Worklist</span>
          </div>
        </div>

        <div className="genesysris-profile">
          <div className="genesysris-avatar">
            <FaUser />
          </div>

          <h4>Radiographer</h4>
          <span>User</span>
        </div>

        <div className="genesysris-menu">
          <div
            className={`genesysris-menu-item ${activeMenu === "home" ? "active" : ""}`}
            onClick={() => {
              setActiveMenu("home");
              navigate("/");
            }}
          >
            <FaHome />
            <span>Home</span>
          </div>

          <div
            className={`genesysris-menu-item ${activeMenu === "register" ? "active" : ""}`}
            onClick={() => {
              setActiveMenu("register");
              navigate("/worklist-simulator");
            }}
          >
            <FaClipboardList />
            <span>Register</span>
          </div>

          {/* <div className="genesysris-menu-title">WORKLIST</div> */}

          {/* <div
            className={`genesysris-menu-item ${activeMenu === "admission" ? "active" : ""}`}
            onClick={() => {
              setActiveMenu("admission");
              navigate("/worklist-radiology");
            }}
          >
            <FaClipboardList />
            <span>Admission</span>
          </div> */}

          {/* <div
            className={`genesysris-menu-item ${activeMenu === "technologist" ? "active" : ""}`}
            onClick={() => {
              setActiveMenu("technologist");
              navigate("/worklist-radiology");
            }}
          >
            <FaUserMd />
            <span>Technologist</span>
          </div> */}

          {/* <div
            className={`genesysris-menu-item ${activeMenu === "physicist" ? "active" : ""}`}
            onClick={() => setActiveMenu("physicist")}
          >
            <FaFlask />
            <span>Physicist</span>
          </div> */}

          {/* <div
            className={`genesysris-menu-item ${activeMenu === "consumable" ? "active" : ""}`}
            onClick={() => setActiveMenu("consumable")}
          >
            <FaBoxes />
            <span>Consumable</span>
          </div> */}

          {/* <div
            className={`genesysris-menu-item ${activeMenu === "qc" ? "active" : ""}`}
            onClick={() => setActiveMenu("qc")}
          >
            <FaCheckCircle />
            <span>Quality Control</span>
          </div> */}

          {/* <div
            className={`genesysris-menu-item ${activeMenu === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveMenu("dashboard")}
          >
            <FaChartBar />
            <span>Dashboard</span>
          </div> */}
        </div>
      </aside>

      <main className="genesysris-main">
        <div className="genesysris-header">
          <div className="genesysris-header-left" />

          <div className="genesysris-header-center">
            <h2 className="genesysris-header-title">{title}</h2>
          </div>

          <div className="genesysris-header-right">
            <button
              className="genesysris-right-toggle"
              onClick={() => {
                setSidebarPinned(!sidebarPinned);
                setRightMenu(!rightMenu);
              }}
            >
              <FaBars />
            </button>
          </div>
        </div>

        <div className="genesysris-table-wrapper">{children}</div>
      </main>

      <aside
        className={`genesysris-rightbar ${rightMenu ? "open" : "closed"}`}
        onMouseEnter={() => {
          if (!sidebarPinned) setRightMenu(true);
        }}
        onMouseLeave={() => {
          if (!sidebarPinned) setRightMenu(false);
        }}
      >
        {/* <button className="genesysris-action-btn">
          <FaUserCog />
          {rightMenu && <span>Setting</span>}
        </button> */}

        {/* <button className="genesysris-action-btn">
          <FaEdit />
          {rightMenu && <span>Edit</span>}
        </button> */}

        <button className="genesysris-action-btn">
          <FaFileExcel />
          {rightMenu && <span>Export to Excel</span>}
        </button>

        <button
          className="genesysris-action-btn"
          onClick={async () => {
            if (!selectedPatient) {
              alert("Silakan pilih pasien terlebih dahulu menggunakan tombol Select.");
              return;
            }
            if (onProcessClick) {
              await onProcessClick();
            }
            setShowProcessModal(true);
          }}
        >
          <FaClipboardList />
          {rightMenu && <span>Process</span>}
        </button>

        <button 
          className={`genesysris-action-btn ${isSelectActive ? "genesysris-btn-active" : ""}`}
          onClick={onSelectClick}
          style={isSelectActive ? { backgroundColor: "#00d4ff", color: "#090d16" } : {}}
        >
          <FaCheck />
          {rightMenu && <span>Select</span>}
        </button>

        {/* <button className="genesysris-action-btn">
          <FaTimes />
          {rightMenu && <span>Unselect All</span>}
        </button> */}

        <button className="genesysris-action-btn">
          <FaSyncAlt />
          {rightMenu && <span>Refresh</span>}
        </button>

        <button className="genesysris-filter-btn">
          <FaFilter />
          {rightMenu && " Filter"}
        </button>
      </aside>

      {showProcessModal && (
        <div className="genesysris-modal-overlay">
          <div className="genesysris-modal">
            <div className="genesysris-modal-header">
              <h3>Technologist Process</h3>

              <button onClick={() => setShowProcessModal(false)}>
                <FaTimes />
              </button>
            </div>

             <label>Modality</label>
            <select value={modality} onChange={(e) => setModality(e.target.value)}>
              <option value="CT">CT</option>
              <option value="MR">MRI</option>
              <option value="ES">Endoscopy</option>
              <option value="CR">X-Ray</option>
              <option value="XC">External-camera Photography</option>
              <option value="US">Ultrasound</option>
            </select>

            <label>AE Title</label>
            <input
              type="text"
              value={aet}
              onChange={(e) => setAet(e.target.value)}
              style={{
                width: "100%",
                height: "48px",
                border: "none",
                borderRadius: "12px",
                background: "#172033",
                color: "white",
                padding: "0 14px",
                marginBottom: "10px",
              }}
            />

             <label>Radiologist</label>
            <select value={radiologist} onChange={(e) => setRadiologist(e.target.value)}>
              <option value="dr. Andi, Sp.Rad">dr. Andi, Sp.Rad</option>
              <option value="dr. Sarah, Sp.Rad">dr. Sarah, Sp.Rad</option>
              <option value="dr. Rahmat, Sp.Rad">dr. Rahmat, Sp.Rad</option>
            </select>

             <label>Technologist 1</label>
            <select value={technologist1} onChange={(e) => setTechnologist1(e.target.value)}>
              <option>Radiographer 1</option>
              <option>Radiographer 2</option>
              <option>Radiographer 3</option>
            </select>

            <label>Technologist 2</label>
            <select value={technologist2} onChange={(e) => setTechnologist2(e.target.value)}>
              <option>Select Technologist</option>
              <option>Radiographer A</option>
              <option>Radiographer B</option>
            </select>

            <div className="genesysris-checkbox">
              <input type="checkbox" />
              <span>Force directly to the radiologist</span>
            </div>

            <label>Room</label>
            <select value={room} onChange={(e) => setRoom(e.target.value)}>
              <option>Ruangan DR</option>
              <option>Ruangan Panoramic</option>
              <option>Ruangan CR</option>
              <option>Ruangan MSCT</option>
              <option>Ruangan MRI</option>
              <option>Ruangan USG</option>
              <option>Ruangan Fluoroscopy</option>
              <option>Ruangan Cathlab</option>
              <option>Ruangan Nuklir</option>
              <option>Ruangan Mammografi</option>
            </select>

            <div className="genesysris-modal-footer">
              <button onClick={() => setShowProcessModal(false)}>Close</button>
              <button
                className="save"
                onClick={() => {
                  if (onSaveProcess) onSaveProcess(selectedPatient, { technologist1, technologist2, room, modality, aet, radiologist });
                  setShowProcessModal(false);
                }}
              >
                Save
              </button>
              <button
                className="save-mwl"
                onClick={() => {
                  if (onSaveProcess) onSaveProcess(selectedPatient, { technologist1, technologist2, room, modality, aet, radiologist });
                  setShowProcessModal(false);
                }}
              >
                Save & MWL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorklistLayout;
