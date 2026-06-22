import { useState } from "react";
import "../../../styles/worklist.css";
import logo from "../../../assets/vismed-logo.png";

import {
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

const WorklistLayout = ({ title = "Technologist", children }) => {
  const [activeMenu, setActiveMenu] = useState("");
  const [rightMenu, setRightMenu] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);

  return (
    <div className="genesysris-page">
      <aside className="genesysris-leftbar">
        <div className="genesysris-brand">
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
            onClick={() => setActiveMenu("home")}
          >
            <FaHome />
            <span>Home</span>
          </div>

          <div
            className={`genesysris-menu-item ${activeMenu === "register" ? "active" : ""}`}
            onClick={() => setActiveMenu("register")}
          >
            <FaClipboardList />
            <span>Register</span>
          </div>

          <div className="genesysris-menu-title">WORKLIST</div>

          <div
            className={`genesysris-menu-item ${activeMenu === "allStudies" ? "active" : ""}`}
            onClick={() => setActiveMenu("allStudies")}
          >
            <FaClipboardList />
            <span>All Studies</span>
          </div>

          <div
            className={`genesysris-menu-item ${activeMenu === "admission" ? "active" : ""}`}
            onClick={() => setActiveMenu("admission")}
          >
            <FaClipboardList />
            <span>Admission</span>
          </div>

          <div
            className={`genesysris-menu-item ${activeMenu === "technologist" ? "active" : ""}`}
            onClick={() => setActiveMenu("technologist")}
          >
            <FaUserMd />
            <span>Technologist</span>
          </div>

          <div
            className={`genesysris-menu-item ${activeMenu === "physicist" ? "active" : ""}`}
            onClick={() => setActiveMenu("physicist")}
          >
            <FaFlask />
            <span>Physicist</span>
          </div>

          <div
            className={`genesysris-menu-item ${activeMenu === "consumable" ? "active" : ""}`}
            onClick={() => setActiveMenu("consumable")}
          >
            <FaBoxes />
            <span>Consumable</span>
          </div>

          <div
            className={`genesysris-menu-item ${activeMenu === "qc" ? "active" : ""}`}
            onClick={() => setActiveMenu("qc")}
          >
            <FaCheckCircle />
            <span>Quality Control</span>
          </div>

          <div
            className={`genesysris-menu-item ${activeMenu === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveMenu("dashboard")}
          >
            <FaChartBar />
            <span>Dashboard</span>
          </div>
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
        <button className="genesysris-action-btn">
          <FaUserCog />
          {rightMenu && <span>Setting</span>}
        </button>

        <button className="genesysris-action-btn">
          <FaEdit />
          {rightMenu && <span>Edit</span>}
        </button>

        <button className="genesysris-action-btn">
          <FaFileExcel />
          {rightMenu && <span>Export to Excel</span>}
        </button>

        <button
          className="genesysris-action-btn"
          onClick={() => setShowProcessModal(true)}
        >
          <FaClipboardList />
          {rightMenu && <span>Process</span>}
        </button>

        <button className="genesysris-action-btn">
          <FaCheck />
          {rightMenu && <span>Select All</span>}
        </button>

        <button className="genesysris-action-btn">
          <FaTimes />
          {rightMenu && <span>Unselect All</span>}
        </button>

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

            <label>Technologist 1</label>
            <select>
              <option>Radiographer 1</option>
              <option>Radiographer 2</option>
              <option>Radiographer 3</option>
            </select>

            <label>Technologist 2</label>
            <select>
              <option>Select Technologist</option>
              <option>Radiographer A</option>
              <option>Radiographer B</option>
            </select>

            <div className="genesysris-checkbox">
              <input type="checkbox" />
              <span>Force directly to the radiologist</span>
            </div>

            <label>Room</label>
            <select>
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
              <button className="save">Save</button>
              <button className="save-mwl">Save & MWL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorklistLayout;
