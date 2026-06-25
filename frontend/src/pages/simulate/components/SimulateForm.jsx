import { Send } from "lucide-react";

const SimulateForm = ({ form, loading, updateForm, submitForm }) => {
  return (
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

        {/* <label className="sim-field">
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
        </label> */}
      </div>

      <button className="sim-submit" type="submit" disabled={loading}>
        <Send size={18} />
        {loading ? "Mengirim..." : "Kirim ke MWL"}
      </button>
    </form>
  );
};

export default SimulateForm;
