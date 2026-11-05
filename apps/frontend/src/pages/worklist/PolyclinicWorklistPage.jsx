import WorklistLayout from "./components/WorklistLayout";

const polyclinicData = [
  {
    visitDate: "11-06-2026 08:00",
    queueNo: "A001",
    patientId: "PL001",
    patientName: "BUDI SANTOSO",
    clinic: "Orthopedic",
    doctor: "dr. Andi",
    status: "Waiting",
  },
  {
    visitDate: "11-06-2026 08:15",
    queueNo: "A002",
    patientId: "PL002",
    patientName: "SITI AMINAH",
    clinic: "Neurology",
    doctor: "dr. Rahmat",
    status: "In Progress",
  },
  {
    visitDate: "11-06-2026 08:30",
    queueNo: "A003",
    patientId: "PL003",
    patientName: "RUDI HARTONO",
    clinic: "Internal Medicine",
    doctor: "dr. Sarah",
    status: "Completed",
  },
];

const PolyclinicWorklistPage = () => {
  return (
    <WorklistLayout title="Polyclinic Worklist">
      <table className="genesysris-table">
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
          {polyclinicData.map((row, index) => (
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
      </table>
    </WorklistLayout>
  );
};

export default PolyclinicWorklistPage;
