import { useEffect, useState } from "react";
import axios from "axios";
import WorklistLayout from "./components/WorklistLayout";

import {
  FaCheck,
  FaCog,
  FaFileAlt,
  FaIdCard,
  FaPaperPlane,
  FaProjectDiagram,
  FaRecycle,
  FaUser,
} from "react-icons/fa";

const RadiologyWorklistPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSelectActive, setIsSelectActive] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [processedPatients, setProcessedPatients] = useState(() => {
    try {
      const saved = localStorage.getItem("processedPatients");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const handleSelectClick = () => {
    setIsSelectActive((prev) => {
      const newVal = !prev;
      if (!newVal) {
        setSelectedPatient(null);
      }
      return newVal;
    });
  };

  const handleSaveProcess = async (patient, processData) => {
    if (!patient) return;
    const newProcessed = {
      ...processedPatients,
      [patient.patientId]: true,
    };
    setProcessedPatients(newProcessed);
    localStorage.setItem("processedPatients", JSON.stringify(newProcessed));
    setIsSelectActive(false);
    setSelectedPatient(null);

    try {
      const payload = {
        patientName: patient.patientName,
        patientID: patient.patientId,
        birthDate: patient.dob || "",
        sex: patient.sex || "M",
        accessionNumber: patient.accession,
        procedureDesc: patient.study,
        scheduleDate: patient.registerDate.split(" ")[0] || "",
        scheduleTime: patient.registerDate.split(" ")[1] || "",
        modality: processData?.modality || patient.modality || "CT",
        aet: processData?.aet || patient.aet || "MODALITY1",
        technologist1: processData?.technologist1,
        technologist2: processData?.technologist2,
        room: processData?.room,
        radiologist: processData?.radiologist,
      };

      await axios.post("http://localhost:3000/simulate/kirim-mwl", payload);
      console.log("MWL updated with tagging successfully");
      await fetchWorklist();
    } catch (err) {
      console.error("Gagal mengupdate tagging MWL:", err);
    }
  };

  const fetchWorklist = () => {
    return axios
      .get("http://localhost:3000/mwl/get-mwl")
      .then((res) => {
        const mapped = res.data.map((row) => {
          const registerDate = [row.date, row.time].filter(Boolean).join(" ") || "-";
          return {
            registerDate,
            patientId: row.id || "-",
            patientName: row.name || "-",
            accession: row.accessionNumber || "-",
            study: row.bodypart || `${row.modality || "CT"} Examination`,
            radiologist: row.radiologist || "-",
            moc: "-",
            wityd: "-",
            sex: row.sex || "-",
            dob: row.dob || "-",
            regNo: "-",
            technologistStatus: "waiting", // default status
            modality: row.modality || "CT",
            aet: row.aet || "MODALITY1",
          };
        });
        
        // Urutkan dari yang paling baru di tanggal paling atas (descending)
        mapped.sort((a, b) => {
          if (a.registerDate === "-" && b.registerDate === "-") return 0;
          if (a.registerDate === "-") return 1;
          if (b.registerDate === "-") return -1;
          return b.registerDate.localeCompare(a.registerDate);
        });

        setData(mapped);
        setError(null);
        return mapped;
      })
      .catch((err) => {
        console.error("Gagal menarik data worklist:", err);
        setError(err.message || "Gagal memuat data worklist");
        return null;
      });
  };

  const handleProcessClick = async () => {
    if (!selectedPatient) return;
    try {
      const latestData = await fetchWorklist();
      if (latestData) {
        const fresh = latestData.find((p) => p.patientId === selectedPatient.patientId);
        if (fresh) {
          setSelectedPatient(fresh);
        } else {
          alert("Pasien yang dipilih tidak ditemukan lagi di server.");
          setSelectedPatient(null);
        }
      }
    } catch (err) {
      console.error("Gagal memperbarui metadata:", err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchWorklist().finally(() => {
      setLoading(false);
    });
  }, []);

  return (
    <WorklistLayout
      title="Radiology Worklist"
      isSelectActive={isSelectActive}
      onSelectClick={handleSelectClick}
      selectedPatient={selectedPatient}
      onSaveProcess={handleSaveProcess}
      onProcessClick={handleProcessClick}
    >
      {loading ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#94A3B8" }}>
          Memuat data worklist dari Orthanc...
        </div>
      ) : error ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#EF4444" }}>
          Error: {error}
        </div>
      ) : data.length === 0 ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#94A3B8" }}>
          Tidak ada data worklist yang tersedia.
        </div>
      ) : (
        <table className="genesysris-table">
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
            {data.map((row, index) => {
              const isSelected = selectedPatient?.patientId === row.patientId;
              const isProcessed = !!processedPatients[row.patientId];
              return (
                <tr
                  key={index}
                  onClick={() => {
                    if (isSelectActive) {
                      setSelectedPatient((prev) =>
                        prev?.patientId === row.patientId ? null : row
                      );
                    }
                  }}
                  style={{
                    cursor: isSelectActive ? "pointer" : "default",
                    backgroundColor: isSelected ? "rgba(0, 212, 255, 0.15)" : undefined,
                    outline: isSelected ? "2px solid #00d4ff" : undefined,
                    outlineOffset: "-2px",
                  }}
                >
                  <td>
                    <div className="genesysris-process-icons">
                      <div
                        className={`process-badge ${isProcessed ? "process-green" : ""}`}
                        style={!isProcessed ? { backgroundColor: "#1e293b", color: "#64748b" } : {}}
                      >
                        <FaIdCard />
                      </div>

                      <div
                        className={`process-badge ${
                          isProcessed ? "process-green" : "process-yellow"
                        }`}
                      >
                        <FaProjectDiagram />
                      </div>

                      {/* <FaUser /> */}
                      {/* <FaCog /> */}
                      {/* <FaFileAlt /> */}
                      {/* <FaRecycle /> */}
                      {/* <FaCheck /> */}
                      {/* <FaPaperPlane /> */}
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
              );
            })}
          </tbody>
        </table>
      )}
    </WorklistLayout>
  );
};

export default RadiologyWorklistPage;
