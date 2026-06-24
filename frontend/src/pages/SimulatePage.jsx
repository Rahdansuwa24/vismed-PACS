import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/simulate.css";
import SimulateForm from "./simulate/components/SimulateForm";
import SimulateHeader from "./simulate/components/SimulateHeader";
import SimulateStatus from "./simulate/components/SimulateStatus";

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
      <SimulateHeader onBack={() => navigate("/")} />

      <main className="sim-content">
        <SimulateForm
          form={form}
          loading={loading}
          updateForm={updateForm}
          submitForm={submitForm}
        />

        <SimulateStatus result={result} error={error} />
      </main>
    </div>
  );
}
