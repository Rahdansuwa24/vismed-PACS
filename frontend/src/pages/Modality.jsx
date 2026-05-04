import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import axios from "axios";
import "../styles/Modal.css";
import logo from "../assets/vismed-logo.png";

export default function HistoryPage() {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [modality, setModality] = useState("");

    const [selected, setSelected] = useState(null); // 🔥 modal state

    useEffect(() => {
        axios.get("http://localhost:3000/mwl/get-mwl")
        .then((res) => {
            const mapped = res.data.map((p, index) => {
                const rawId = p.id || p.patientID || p.PatientID || index;
                const id = p.id ? `${p.id}_${index}` : rawId;

                return {
                    id,
                    rawId,
                    name: p.name || p.PatientName || "-",
                    modality: p.modality || p.Modality || "-",
                    date: [p.date, p.time].filter(Boolean).join(" "),
                    desc: p.study || p.StudyDescription || p.description || "-",
                    body: p.bodypart || p.BodyPartExamined || "-",
                    doctor: p.doctor || p.ReferringPhysicianName || "-",
                    result: p.result || "-",
                    accession: id,
                };
            });

            setData(mapped);
        })
        .catch((err) => {
            console.error("ERROR:", err);
            setData([]);
        });
    }, []);

    const filtered = useMemo(() => {
        if (!modality) {
            return data;
        }

        return data.filter((item) => item.modality === modality);
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
                    <span>Accession: {item.accession}</span>
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
                {/* <div>
                    <span>Doctor</span>
                    <strong>{selected.doctor}</strong>
                </div> */}
                <div>
                    <span>Accession</span>
                    <strong>{selected.accession}</strong>
                </div>
                {/* <div>
                    <span>Result</span>
                    <strong>{selected.result}</strong>
                </div> */}
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
