var express = require("express");
var router = express.Router();
var axios = require("axios");

const endpoint = process.env.ENDPOINT || process.env.endpoint;

let db = null;

try {
  const mysql = require("mysql2");
  db = mysql.createConnection({
    host: process.env.SIM_DB_HOST || "localhost",
    user: process.env.SIM_DB_USER || "root",
    password: process.env.SIM_DB_PASSWORD || "",
    database: process.env.SIM_DB_NAME || "ris_simulasi",
  });
} catch (err) {
  console.warn("MYSQL SIMULASI NONAKTIF:", err.message);
}

function formatDate(value, fallback = "") {
  if (!value) return fallback;
  return String(value).replaceAll("-", "");
}

function formatTime(value, fallback = "100000") {
  if (!value) return fallback;
  const [hour = "00", minute = "00", second = "00"] = String(value).split(":");
  return `${hour.padStart(2, "0")}${minute.padStart(2, "0")}${second.padStart(2, "0")}`;
}

function validateModality(value) {
  const modality = String(value || "CT").toUpperCase();
  const allowed = ["CT", "MR", "ES", "CR", "XC", "XR", "US"];
  return allowed.includes(modality) ? modality : "CT";
}

function normalizePatientName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "^");
}

function getBodyValue(body, key) {
  const value = body?.[key];

  if (value === undefined || value === null || value === "null" || value === "undefined") {
    return "";
  }

  return String(value).trim();
}

function normalizeMwlPayload(body) {
  const patientID = getBodyValue(body, "patientID");
  const patientName = getBodyValue(body, "patientName");
  const scheduleDate = getBodyValue(body, "scheduleDate");

  return {
    patientID,
    patientName: normalizePatientName(patientName),
    birthDate: formatDate(getBodyValue(body, "birthDate")),
    sex: getBodyValue(body, "sex") || "M",
    accessionNumber: getBodyValue(body, "accessionNumber"),
    procedureDesc: getBodyValue(body, "procedureDesc") || "GENERAL CHECK",
    scheduleDate: formatDate(scheduleDate),
    scheduleTime: formatTime(getBodyValue(body, "scheduleTime"), ""),
    aet: getBodyValue(body, "aet") || "MODALITY1",
    modality: validateModality(getBodyValue(body, "modality")),
  };
}

function getMissingFields(payload) {
  return ["patientID", "patientName", "birthDate", "accessionNumber", "scheduleDate", "scheduleTime"].filter(
    (field) => !payload[field]
  );
}

function savePatientToDatabase(rawData) {
  if (!db) return;

  db.query(
    `INSERT INTO pasien
      (patient_id, nama, birth_date, sex, accession_number, procedure_desc, schedule_date, schedule_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      getBodyValue(rawData, "patientID"),
      getBodyValue(rawData, "patientName"),
      getBodyValue(rawData, "birthDate"),
      getBodyValue(rawData, "sex"),
      getBodyValue(rawData, "accessionNumber"),
      getBodyValue(rawData, "procedureDesc"),
      getBodyValue(rawData, "scheduleDate"),
      getBodyValue(rawData, "scheduleTime"),
    ],
    (err) => {
      if (err) console.error("MYSQL SIMULASI ERROR:", err.message);
    }
  );
}

function wantsHtml(req) {
  return req.headers.accept?.includes("text/html") && !req.headers.accept?.includes("application/json");
}

router.post("/kirim-mwl", async function (req, res) {
  try {
    if (!endpoint) {
      return res.status(500).json({ error: "ENDPOINT belum dikonfigurasi" });
    }

    const normalized = normalizeMwlPayload(req.body);
    const missingFields = getMissingFields(normalized);

    if (missingFields.length) {
      return res.status(400).json({
        error: `Metadata pasien tidak lengkap: ${missingFields.join(", ")}`,
        metadata: normalized,
      });
    }

    savePatientToDatabase(req.body);

    const response = await axios.post(`${endpoint}/mwl-post`, normalized, {
      headers: { "Content-Type": "application/json" },
    });

    if (wantsHtml(req)) {
      return res.send(`
        <h2>MWL berhasil dibuat</h2>
        <p>Patient: ${normalized.patientName}</p>
        <p>Modality: ${normalized.modality}</p>
        <p>AE Title: ${normalized.aet}</p>
        <a href="/dashboard">Kembali</a>
      `);
    }

    res.json({
      message: "MWL berhasil dibuat",
      metadata: normalized,
      mwl: response.data,
    });
  } catch (err) {
    console.error("SIMULASI MWL ERROR:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message || "Gagal kirim MWL",
    });
  }
});

module.exports = router;
