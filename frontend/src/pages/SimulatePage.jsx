import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import axios from "axios";
import "../styles/simulate.css";
import logo from "../assets/vismed-logo.png";

const initialForm = {
  patientName: "",
  patientID: "",
  birthDate: "",
  sex: "M",
  accessionNumber: "",
  procedureDesc: "CT THORAX",
  scheduleDate: "",
  scheduleTime: "",
  modality: "CT",
  aet: "MODALITY1",
};

export default function SimulatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    setError("");

    try {
      const response = await axios.post("/simulate/kirim-mwl", form);
      setResult(response.data);
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Gagal mengirim MWL";
      setError(typeof message === "string" ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sim-page">
      <header className="sim-header">
        <div className="sim-header-left">
          <button className="sim-icon-button" onClick={() => navigate("/dashboard")} type="button">
            <ArrowLeft size={20} />
          </button>
          <img src={logo} className="sim-logo" alt="VisMed" />
          <div>
            <div className="sim-title">Simulasi DICOM MWL</div>
            <div className="sim-subtitle">Kirim metadata pasien ke bridge untuk dibuat menjadi worklist .wl</div>
          </div>
        </div>
      </header>

      <main className="sim-content">
        <form className="sim-form" onSubmit={submitForm}>
          <div className="sim-form-grid">
            <label className="sim-field">
              <span>Nama Pasien</span>
              <input name="patientName" value={form.patientName} onChange={updateForm} required />
            </label>

            <label className="sim-field">
              <span>No RM / Patient ID</span>
              <input name="patientID" value={form.patientID} onChange={updateForm} required />
            </label>

            <label className="sim-field">
              <span>Tanggal Lahir</span>
              <input name="birthDate" type="date" value={form.birthDate} onChange={updateForm} required />
            </label>

            <label className="sim-field">
              <span>Jenis Kelamin</span>
              <select name="sex" value={form.sex} onChange={updateForm}>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </label>

            <label className="sim-field">
              <span>Accession Number</span>
              <input name="accessionNumber" value={form.accessionNumber} onChange={updateForm} required />
            </label>

            <label className="sim-field">
              <span>Deskripsi Pemeriksaan</span>
              <input name="procedureDesc" value={form.procedureDesc} onChange={updateForm} required />
            </label>

            <label className="sim-field">
              <span>Tanggal Jadwal</span>
              <input name="scheduleDate" type="date" value={form.scheduleDate} onChange={updateForm} required />
            </label>

            <label className="sim-field">
              <span>Waktu Jadwal</span>
              <input name="scheduleTime" type="time" value={form.scheduleTime} onChange={updateForm} required />
            </label>

            <label className="sim-field">
              <span>Modality</span>
              <select name="modality" value={form.modality} onChange={updateForm}>
                <option value="CT">CT</option>
                <option value="MR">MRI</option>
                <option value="ES">Endoscopy</option>
                <option value="CR">X-Ray</option>
                <option value="XC">External-camera Photography</option>
                <option value="US">Ultrasound</option>
              </select>
            </label>

            <label className="sim-field">
              <span>AE Title</span>
              <input name="aet" value={form.aet} onChange={updateForm} required />
            </label>
          </div>

          <button className="sim-submit" type="submit" disabled={loading}>
            <Send size={18} />
            {loading ? "Mengirim..." : "Kirim ke MWL"}
          </button>
        </form>

        {result && (
          <section className="sim-status sim-status-success">
            <CheckCircle2 size={20} />
            <div>
              <strong>{result.message}</strong>
              <span>{result.metadata.patientName} | {result.metadata.modality} | {result.metadata.aet}</span>
            </div>
          </section>
        )}

        {error && (
          <section className="sim-status sim-status-error">
            <AlertTriangle size={20} />
            <div>
              <strong>Gagal kirim MWL</strong>
              <span>{error}</span>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
