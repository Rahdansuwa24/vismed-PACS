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

const radiologyData = [
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
    technologistStatus: "waiting",
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
    technologistStatus: "done",
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
    technologistStatus: "waiting",
  },
];

const RadiologyWorklistPage = () => {
  return (
    <WorklistLayout title="Radiology Worklist">
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
          {radiologyData.map((row, index) => (
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
                    <FaProjectDiagram />
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
      </table>
    </WorklistLayout>
  );
};

export default RadiologyWorklistPage;
