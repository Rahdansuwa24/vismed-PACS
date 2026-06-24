import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Activity, Terminal, ClipboardList, Database, AlertCircle } from "lucide-react";
import axios from "axios";
import "../styles/forwarder.css";
import "../styles/Modal.css";
import logo from "../assets/vismed-logo.png";

export default function EcgForwarder() {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ status: "offline", config: {} });
  const [logs, setLogs] = useState([]);
  const [autoPoll, setAutoPoll] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const terminalRef = useRef(null);

  // Fetch status and logs
  const fetchData = async () => {
    try {
      const statusRes = await axios.get("http://localhost:3000/pacs/ecg-status");
      setStatus(statusRes.data);

      const logsRes = await axios.get("http://localhost:3000/pacs/ecg-logs");
      setLogs(logsRes.data);
    } catch (err) {
      console.error("Gagal mengambil data monitoring ECG:", err);
    }
  };

  // Polling hook
  useEffect(() => {
    fetchData();
    if (!autoPoll) return;

    const timer = setInterval(fetchData, 3000);
    return () => clearInterval(timer);
  }, [autoPoll]);

  // Scroll to bottom of terminal whenever logs change
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Compute stats based on logs
  const stats = (() => {
    const uniqueFiles = new Set();
    const successfulFiles = new Set();
    const failedFiles = new Set();

    logs.forEach(log => {
      if (log.filename && log.filename !== "-") {
        uniqueFiles.add(log.filename);
        if (log.status === "success" && log.message.includes("Orthanc PACS")) {
          successfulFiles.add(log.filename);
        }
        if (log.status === "error") {
          failedFiles.add(log.filename);
        }
      }
    });

    return {
      total: uniqueFiles.size,
      success: successfulFiles.size,
      failed: failedFiles.size
    };
  })();

  // Filter logs to find actual file transactions for the history table
  const transactions = (() => {
    const txMap = {};
    
    // Sort chronological (oldest to newest) to build status, then reverse
    const sortedLogs = [...logs].reverse();

    sortedLogs.forEach(log => {
      if (!log.filename || log.filename === "-") return;

      if (!txMap[log.filename]) {
        txMap[log.filename] = {
          filename: log.filename,
          nomor_pelayanan: log.nomor_pelayanan,
          timestamp: log.timestamp,
          orthancStatus: "pending",
          simrsStatus: "pending",
          details: []
        };
      }

      txMap[log.filename].details.push(log);
      
      // Update status flags based on log messages
      if (log.message.includes("Orthanc PACS") && log.status === "success") {
        txMap[log.filename].orthancStatus = "success";
      } else if (log.message.includes("Orthanc") && log.status === "error") {
        txMap[log.filename].orthancStatus = "failed";
      }

      if (log.message.includes("SIMRS") && log.status === "success") {
        txMap[log.filename].simrsStatus = "success";
      } else if (log.message.includes("SIMRS") && log.status === "warning") {
        txMap[log.filename].simrsStatus = "skipped";
      } else if (log.message.includes("SIMRS") && log.status === "error") {
        txMap[log.filename].simrsStatus = "failed";
      }
    });

    return Object.values(txMap).reverse(); // Newest first
  })();

  return (
    <div className="ecgF_container">
      {/* HEADER */}
      <header className="ecgF_header">
        <div className="ecgF_headerLeft">
          <button className="ecgF_backBtn" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={20} />
          </button>
          <img src={logo} className="ecgF_logo" alt="Logo" />
          <div>
            <div className="ecgF_title">ECG Forwarder Monitor</div>
            <div className="ecgF_subtitle">
              Monitor real-time ECG integration between FTP, Orthanc PACS & SIMRS
            </div>
          </div>
        </div>

        <div className="ecgF_refreshControls">
          <div className="ecgF_pollStatus">
            {autoPoll ? "Auto-refreshing (3s)" : "Auto-refresh paused"}
          </div>
          <button className="ecgF_toggleBtn" onClick={() => setAutoPoll(!autoPoll)}>
            {autoPoll ? "Pause" : "Resume"}
          </button>
          <button className="ecgF_toggleBtn" style={{ padding: "6px" }} onClick={fetchData}>
            <RefreshCw size={16} />
          </button>

          <div className={`ecgF_statusBox ${status.status}`}>
            <span className="ecgF_pulse"></span>
            {status.status === "active" ? "Active" : "Offline"}
          </div>
        </div>
      </header>

      {/* LAYOUT GRID */}
      <div className="ecgF_layoutGrid">
        
        {/* LEFT COLUMN: Status & Stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* CONFIG CARD */}
          <div className="ecgF_card">
            <h3 className="ecgF_cardTitle">
              <span>Configuration Info</span>
              <Activity size={18} style={{ color: "#00c2a8" }} />
            </h3>
            <div className="ecgF_infoList">
              <div className="ecgF_infoItem">
                <span className="ecgF_infoLabel">Watch FTP Folder</span>
                <span className="ecgF_infoValue">
                  {status.config?.watchDir || "D:\\PA\\EDAN\\EDAN"}
                </span>
              </div>
              <div className="ecgF_infoItem">
                <span className="ecgF_infoLabel">Orthanc PACS Endpoint</span>
                <span className="ecgF_infoValue">
                  {status.config?.orthancUrl || "http://10.9.23.18:8042"}
                </span>
              </div>
              <div className="ecgF_infoItem">
                <span className="ecgF_infoLabel">Last Heartbeat</span>
                <span className="ecgF_infoValue">
                  {status.lastHeartbeat 
                    ? new Date(status.lastHeartbeat).toLocaleString()
                    : "Belum terdeteksi"}
                </span>
              </div>
            </div>

            {/* STATS */}
            <div className="ecgF_statsRow">
              <div className="ecgF_statItem total">
                <div className="ecgF_statNum">{stats.total}</div>
                <div className="ecgF_statLabel">Files Processed</div>
              </div>
              <div className="ecgF_statItem success">
                <div className="ecgF_statNum">{stats.success}</div>
                <div className="ecgF_statLabel">Success uploads</div>
              </div>
              <div className="ecgF_statItem error">
                <div className="ecgF_statNum">{stats.failed}</div>
                <div className="ecgF_statLabel">Errors</div>
              </div>
            </div>
          </div>

          {/* SIMRS INFO */}
          <div className="ecgF_card">
            <h3 className="ecgF_cardTitle">
              <span>SIMRS Integration Gate</span>
              <Database size={18} style={{ color: "#3B82F6" }} />
            </h3>
            <div className="ecgF_infoList">
              <div className="ecgF_infoItem" style={{ fontSize: "13px", lineHeight: "1.5", color: "#9CA3AF" }}>
                Proses pengiriman ke SIMRS membutuhkan validasi **Nomor Pelayanan** pada nama file:
                <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px", borderRadius: "6px", margin: "6px 0", fontFamily: "monospace", fontSize: "11.5px", border: "1px solid rgba(255,255,255,0.04)" }}>
                  20260620-120000-mcu-<strong>888888</strong>.pdf
                </div>
                Jika nomor pelayanan tidak cocok dengan data pelayanan SIMRS, file tidak dikirim ke SIMRS (diabaikan) tetapi tetap diunggah ke Orthanc.
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Terminal Logs */}
        <div className="ecgF_card" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <h3 className="ecgF_cardTitle">
            <span>Live Console Log</span>
            <Terminal size={18} style={{ color: "#10B981" }} />
          </h3>
          <div className="ecgF_terminal" ref={terminalRef}>
            {logs.length === 0 ? (
              <div style={{ color: "#6B7280", fontStyle: "italic" }}>Menunggu log aktivitas dari forwarder...</div>
            ) : (
              [...logs].reverse().map((log) => (
                <div key={log.id} className={`ecgF_logLine ${log.status}`}>
                  [{log.timestamp}] [{log.level}] {log.message} {log.filename !== "-" ? `(File: ${log.filename})` : ""}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* TRANSACTION HISTORY */}
      <div className="ecgF_card">
        <h3 className="ecgF_cardTitle">
          <span>Processed PDF History</span>
          <ClipboardList size={18} style={{ color: "#F59E0B" }} />
        </h3>

        <div className="ecgF_tableWrapper">
          <table className="ecgF_table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>File Name</th>
                <th>Patient ID</th>
                <th>Orthanc Status</th>
                <th>SIMRS Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", color: "#6B7280", padding: "30px" }}>
                    Belum ada file PDF yang terdeteksi dan diproses.
                  </td>
                </tr>
              ) : (
                transactions.map((tx, idx) => (
                  <tr key={idx}>
                    <td>{tx.timestamp}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{tx.filename}</td>
                    <td><strong>{tx.nomor_pelayanan}</strong></td>
                    <td>
                      <span className={`ecgF_badge ${
                        tx.orthancStatus === "success" ? "success" : 
                        tx.orthancStatus === "failed" ? "failed" : "warning"
                      }`}>
                        {tx.orthancStatus === "success" ? "Uploaded" : 
                         tx.orthancStatus === "failed" ? "Failed" : "Pending"}
                      </span>
                    </td>
                    <td>
                      <span className={`ecgF_badge ${
                        tx.simrsStatus === "success" ? "success" : 
                        tx.simrsStatus === "skipped" ? "warning" : 
                        tx.simrsStatus === "failed" ? "failed" : "warning"
                      }`}>
                        {tx.simrsStatus === "success" ? "Sent" : 
                         tx.simrsStatus === "skipped" ? "Skipped" : 
                         tx.simrsStatus === "failed" ? "Failed" : "Pending"}
                      </span>
                    </td>
                    <td>
                      <button className="ecgF_detailBtn" onClick={() => setSelectedLog(tx)}>
                        View Logs
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= DETAIL LOGS MODAL ================= */}
      {selectedLog && (
        <div className="vhx-modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="vhx-modal" style={{ maxWidth: "700px", width: "90%" }} onClick={(e) => e.stopPropagation()}>
            <button className="vhx-modal-close" onClick={() => setSelectedLog(null)}>
              ✕
            </button>

            <div className="vhx-modal-header">
              <div className="vhx-modal-title">Logs for: {selectedLog.filename}</div>
              <div className="ecgF_badge success" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#F59E0B" }}>
                ID: {selectedLog.nomor_pelayanan}
              </div>
            </div>

            <div style={{ background: "#090d16", borderRadius: "10px", padding: "15px", fontFamily: "monospace", fontSize: "12px", overflowY: "auto", maxHeight: "350px", border: "1px solid rgba(255,255,255,0.06)", marginTop: "15px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {selectedLog.details.map((log) => (
                <div key={log.id} className={log.status} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: "6px" }}>
                  <span style={{ color: "#9CA3AF" }}>[{log.timestamp}]</span> <strong>{log.message}</strong>
                </div>
              ))}
            </div>

            <div className="vhx-modal-footer" style={{ marginTop: "15px", textAlign: "right" }}>
              Processed at: {selectedLog.timestamp}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
