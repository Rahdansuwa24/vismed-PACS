import { AlertTriangle, CheckCircle2 } from "lucide-react";

const SimulateStatus = ({ result, error }) => {
  return (
    <>
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
    </>
  );
};

export default SimulateStatus;
