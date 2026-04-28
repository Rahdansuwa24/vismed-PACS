import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "../styles/Modal.css";
import logo from "../assets/vismed-logo.png";

export default function HistoryPage() {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [modality, setModality] = useState("");

    const [selected, setSelected] = useState(null); // 🔥 modal state

    useEffect(() => {
        const historyData = [
        {
            name: "Doe Pierre",
            modality: "CT",
            date: "2026-01-11 09:40",
            desc: "CT Lung Scan",
            body: "Lung",
            doctor: "Dr. Wira",
            result: "Mild inflammation",
            accession: "CT20260111-033",
        },
        {
            name: "John Wick",
            modality: "XR",
            date: "2026-02-03 13:10",
            desc: "Chest X-Ray",
            body: "Chest",
            doctor: "Dr. Andika",
            result: "Normal",
            accession: "XR20260203-102",
        },
        {
            name: "Alice Johnson",
            modality: "MR",
            date: "2026-03-15 08:25",
            desc: "Brain MRI",
            body: "Brain",
            doctor: "Dr. Satria",
            result: "Small lesion detected",
            accession: "MR20260315-221",
        },
        ];

        setData(historyData);
        setFiltered(historyData);
    }, []);

    useEffect(() => {
        if (!modality) {
        setFiltered(data);
        } else {
        setFiltered(data.filter((item) => item.modality === modality));
        }
    }, [modality, data]);

    return (
        <div className="vhx-container">

        {/* HEADER */}
        <header className="vhx-header">
            <div className="vhx-header-left">
            <div
                className="vhx-back"
                onClick={() => {
                    if (window.history.length > 1) {
                        navigate(-1);
                    } else {
                        navigate("/dashboard");
                    }
                }}
            >
                <ArrowLeft size={20} />
            </div>
            <img src={logo} className="vhx-logo" />
            <div>
                <div className="vhx-title">VisMed Worklist Manage</div>
                <div className="vhx-subtitle">
                Filter and view patient examination data
                </div>
            </div>
            </div>
        </header>

        {/* CONTENT */}
        <div className="vhx-content">
            <div className="vhx-card">

            {/* FILTER */}
            <div className="vhx-filter-box">
                <label className="vhx-label">Filter Modality</label>
                <select
                className="vhx-select"
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                >
                <option value="">All Modality</option>
                <option value="CT">CT Scan</option>
                <option value="MR">MRI</option>
                <option value="XR">X-Ray</option>
                <option value="US">Ultrasound</option>
                </select>
            </div>

            {/* LIST */}
            <div className="vhx-list">
                {filtered.map((item, index) => (
                <div
                    key={index}
                    className="vhx-item"
                    onClick={() => setSelected(item)} // 🔥 trigger modal
                >
                    <div className="vhx-item-name">{item.name}</div>
                    <div className="vhx-item-meta">
                    <span>{item.modality}</span>
                    <span>{item.date}</span>
                    </div>
                    <div className="vhx-item-desc">{item.desc}</div>
                </div>
                ))}
            </div>

            </div>
        </div>

        {/* ================= MODAL ================= */}
        {selected && (
            <div className="vhx-modal-overlay" onClick={() => setSelected(null)}>
            <div
                className="vhx-modal"
                onClick={(e) => e.stopPropagation()}
            >
                
                {/* CLOSE */}
                <button
                className="vhx-modal-close"
                onClick={() => setSelected(null)}
                >
                ✕
                </button>

                {/* TITLE */}
                <div className="vhx-modal-header">
                <div className="vhx-modal-title">{selected.desc}</div>
                <div className="vhx-badge">{selected.modality}</div>
                </div>

                {/* GRID */}
                <div className="vhx-modal-grid">
                <div>
                    <span>Body Part</span>
                    <strong>{selected.body}</strong>
                </div>
                <div>
                    <span>Doctor</span>
                    <strong>{selected.doctor}</strong>
                </div>
                <div>
                    <span>Accession</span>
                    <strong>{selected.accession}</strong>
                </div>
                <div>
                    <span>Result</span>
                    <strong>{selected.result}</strong>
                </div>
                </div>

                <div className="vhx-modal-footer">
                {selected.date}
                </div>

            </div>
            </div>
        )}

        </div>
    );
}