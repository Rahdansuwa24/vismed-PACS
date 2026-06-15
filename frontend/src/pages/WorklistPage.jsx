    import React, { useState } from "react";
    import "../styles/worklist.css";
    import logo from "../assets/vismed-logo.png";

    import {
    FaHome,
    FaClipboardList,
    FaIdCard,
    FaUserMd,
    FaFlask,
    FaBoxes,
    FaCheckCircle,
    FaChartBar,
    FaCog,
    FaUser,
    FaFileAlt,
    FaRecycle,
    FaCheck,
    FaPaperPlane,
    FaEdit,
    FaFileExcel,
    FaSyncAlt,
    FaFilter,
    FaTimes,
    FaUserCog,
    FaProjectDiagram,
    } from "react-icons/fa";

    const WorklistPage = () => {

    const [activeMenu, setActiveMenu] = useState("");
    const [activeTab, setActiveTab] = useState("radiologist");
    const [activeAction, setActiveAction] = useState("");

    const [rightMenu, setRightMenu] = useState(false);
    const [sidebarPinned, setSidebarPinned] = useState(false);
    const [showProcessModal, setShowProcessModal] = useState(false);

    const dummyData = [
        {
        registerDate: "11-06-2026 09:29:29",
        patientId: "110225",
        patientName: "SRI NATUNJY",
        accession: "107242",
        study: "Genu AP Sinistra",
        radiologist: "-",
        moc: "-",
        wityd: "-",
        sex: "F",
        dob: "1999-02-15",
        regNo: "REG001",
        technologistStatus: "waiting"
        },
        {
        registerDate: "11-06-2026 09:15:59",
        patientId: "879045",
        patientName: "ISMA AUDRY",
        accession: "107241",
        study: "Antebrachii AP",
        radiologist: "-",
        moc: "-",
        wityd: "-",
        sex: "F",
        dob: "2000-05-11",
        regNo: "REG002",
        technologistStatus: "done"
        },
        {
        registerDate: "11-06-2026 08:40:10",
        patientId: "451210",
        patientName: "AHMAD FAUZI",
        accession: "107240",
        study: "Thorax AP",
        radiologist: "-",
        moc: "-",
        wityd: "-",
        sex: "M",
        dob: "1988-08-10",
        regNo: "REG003",
        technologistStatus: "waiting"
        }
    ];

    const polyclinicData = [
    {
        visitDate: "11-06-2026 08:00",
        queueNo: "A001",
        patientId: "PL001",
        patientName: "BUDI SANTOSO",
        clinic: "Orthopedic",
        doctor: "dr. Andi",
        status: "Waiting"
    },
    {
        visitDate: "11-06-2026 08:15",
        queueNo: "A002",
        patientId: "PL002",
        patientName: "SITI AMINAH",
        clinic: "Neurology",
        doctor: "dr. Rahmat",
        status: "In Progress"
    },
    {
        visitDate: "11-06-2026 08:30",
        queueNo: "A003",
        patientId: "PL003",
        patientName: "RUDI HARTONO",
        clinic: "Internal Medicine",
        doctor: "dr. Sarah",
        status: "Completed"
    }
    ];

    return (
        <div className="genesysris-page">

        {/* LEFT SIDEBAR */}

        <aside className="genesysris-leftbar">

            <div className="genesysris-brand">

            <div className="genesysris-brand-logo">
                <img
                src={logo}
                alt="logo"
                className="genesysris-brand-imglogo"
                />
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
                className={`genesysris-menu-item ${
                activeMenu === "home" ? "active" : ""
                }`}
                onClick={() => setActiveMenu("home")}
            >
                <FaHome />
                <span>Home</span>
            </div>

            <div
                className={`genesysris-menu-item ${
                activeMenu === "register" ? "active" : ""
                }`}
                onClick={() => setActiveMenu("register")}
            >
                <FaClipboardList />
                <span>Register</span>
            </div>

            <div className="genesysris-menu-title">
                WORKLIST
            </div>

            <div
                className={`genesysris-menu-item ${
                activeMenu === "allStudies"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                setActiveMenu("allStudies")
                }
            >
                <FaClipboardList />
                <span>All Studies</span>
            </div>

            <div
                className={`genesysris-menu-item ${
                activeMenu === "admission"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                setActiveMenu("admission")
                }
            >
                <FaClipboardList />
                <span>Admission</span>
            </div>

            <div
                className={`genesysris-menu-item ${
                activeMenu === "technologist"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                setActiveMenu("technologist")
                }
            >
                <FaUserMd />
                <span>Technologist</span>
            </div>

            <div
                className={`genesysris-menu-item ${
                activeMenu === "physicist"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                setActiveMenu("physicist")
                }
            >
                <FaFlask />
                <span>Physicist</span>
            </div>

            <div
                className={`genesysris-menu-item ${
                activeMenu === "consumable"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                setActiveMenu("consumable")
                }
            >
                <FaBoxes />
                <span>Consumable</span>
            </div>

            <div
                className={`genesysris-menu-item ${
                activeMenu === "qc"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                setActiveMenu("qc")
                }
            >
                <FaCheckCircle />
                <span>Quality Control</span>
            </div>

            <div
                className={`genesysris-menu-item ${
                activeMenu === "dashboard"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                setActiveMenu("dashboard")
                }
            >
                <FaChartBar />
                <span>Dashboard</span>
            </div>

            </div>

        </aside>

        {/* MAIN */}

        <main className="genesysris-main">

            <div className="genesysris-header">

            <div className="genesysris-header-left">

                <button
                className={`genesysris-tab ${
                    activeTab === "radiologist"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                    setActiveTab("radiologist")
                }
                >
                Radiologist
                </button>

                <button
                className={`genesysris-tab ${
                    activeTab === "polyclinic"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                    setActiveTab("polyclinic")
                }
                >
                Polyclinic
                </button>

            </div>

        <div className="genesysris-header-center">

            <h2 className="genesysris-header-title">
            Technologist
            </h2>

        </div>

        <div className="genesysris-header-right">

            <button
            className="genesysris-right-toggle"
            onClick={() => {
                setSidebarPinned(!sidebarPinned);
                setRightMenu(!rightMenu);
            }}
            >
            ☰
            </button>

        </div>

        </div>

        <div className="genesysris-table-wrapper">

    <table className="genesysris-table">

    {activeTab === "radiologist" ? (

        <>
        <thead>
            <tr>
            <th>Process</th>
            <th>Register Date</th>
            <th>Patient ID</th>
            <th>Patient Name</th>
            <th>Accession No</th>
            <th>Study</th>
            <th>Radiologist</th>
            <th>Moc</th>
            <th>Wityd</th>
            <th>Sex</th>
            <th>DOB</th>
            <th>Register Number</th>
            </tr>
        </thead>

        <tbody>

            {dummyData.map((row,index) => (
            <tr key={index}>

                <td>
                <div className="genesysris-process-icons">

                    <div className="process-badge process-green">
                    <FaIdCard />
                    </div>

                    <div
                    className={`process-badge ${
                        row.technologistStatus === "waiting"
                        ? "process-yellow"
                        : "process-green"
                    }`}
                    >
                    < FaProjectDiagram/>
                    </div>

                    <FaUser />
                    <FaCog />
                    <FaFileAlt />
                    <FaRecycle />
                    <FaCheck />
                    <FaPaperPlane />

                </div>
                </td>

                <td>{row.registerDate}</td>
                <td>{row.patientId}</td>
                <td>{row.patientName}</td>
                <td>{row.accession}</td>
                <td>{row.study}</td>
                <td>{row.radiologist}</td>
                <td>{row.moc}</td>
                <td>{row.wityd}</td>
                <td>{row.sex}</td>
                <td>{row.dob}</td>
                <td>{row.regNo}</td>

            </tr>
            ))}

        </tbody>
        </>

    ) : (

        <>
        <thead>
            <tr>
            <th>Queue No</th>
            <th>Visit Date</th>
            <th>Patient ID</th>
            <th>Patient Name</th>
            <th>Clinic</th>
            <th>Doctor</th>
            <th>Status</th>
            </tr>
        </thead>

        <tbody>

            {polyclinicData.map((row,index) => (
            <tr key={index}>

                <td>{row.queueNo}</td>
                <td>{row.visitDate}</td>
                <td>{row.patientId}</td>
                <td>{row.patientName}</td>
                <td>{row.clinic}</td>
                <td>{row.doctor}</td>
                <td>{row.status}</td>

            </tr>
            ))}

        </tbody>
        </>

    )}

    </table>

        </div>

    </main>

    {/* RIGHT SIDEBAR */}

    <aside
        className={`genesysris-rightbar ${
        rightMenu ? "open" : "closed"
        }`}
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

    {/* PROCESS MODAL */}

    {showProcessModal && (
        <div className="genesysris-modal-overlay">

        <div className="genesysris-modal">

            <div className="genesysris-modal-header">

            <h3>Technologist Process</h3>

            <button
                onClick={() => setShowProcessModal(false)}
            >
                ✕
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

            <span>
                Force directly to the radiologist
            </span>

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

            <button
                onClick={() => setShowProcessModal(false)}
            >
                Close
            </button>

            <button className="save">
                Save
            </button>

            <button className="save-mwl">
                Save & MWL
            </button>

            </div>

        </div>

        </div>
    )}

    </div>

    );
    };

    export default WorklistPage;