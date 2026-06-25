var express = require("express");
var router = express.Router();
var axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
const fs = require("fs");
const upload = multer({ dest: "tmp/" });
const PACS_URL = process.env.PACS_URL;
const endpoint = process.env.ENDPOINT || process.env.endpoint;

function getBodyValue(body, key) {
  const value = body?.[key];

  if (value === undefined || value === null || value === "null" || value === "undefined") {
    return "";
  }

  return String(value).trim();
}

function getUploadMetadata(body) {
  return {
    patientID: getBodyValue(body, "patientID"),
    name: getBodyValue(body, "name"),
    modality: getBodyValue(body, "modality"),
    bodypart: getBodyValue(body, "bodypart"),
    date: getBodyValue(body, "date"),
    time: getBodyValue(body, "time"),
  };
}

router.get("/studies", async function (req, res) {
  try {
    console.log(PACS_URL);
    const response = await axios.get(`${PACS_URL}/studies`, {
      auth: {
        username: process.env.ORTHANC_USERNAME,
        password: process.env.ORTHANC_PASSWORD
      }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/get-mwl", async function (req, res) {
  try {
    const response = await axios.get(`${endpoint}/mwl-get`);

    res.json(response.data);

  } catch (err) {
    console.log("MWL ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/upload-videos", upload.single("video"), async (req, res) => {
  let tempPath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video uploaded" });
    }

    console.log("WINDOWS FILE:", req.file);
    console.log("WINDOWS BODY:", req.body);

    if (!endpoint) {
      return res.status(500).json({ error: "ENDPOINT belum dikonfigurasi" });
    }

    const metadata = getUploadMetadata(req.body);
    const missingFields = Object.entries(metadata)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length) {
      return res.status(400).json({
        error: `Metadata upload tidak lengkap: ${missingFields.join(", ")}`,
        metadata,
      });
    }

    const form = new FormData();

    form.append("video", fs.createReadStream(req.file.path));
    form.append("patientID", metadata.patientID);
    form.append("name", metadata.name);
    form.append("modality", metadata.modality);
    form.append("bodypart", metadata.bodypart);
    form.append("date", metadata.date);
    form.append("time", metadata.time);

    const response = await axios.post(
     `${endpoint}/upload-video` ,
      form,
      {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    res.json(response.data);

  } catch (err) {
    console.error("❌ FULL ERROR:");

  if (err.response) {
    console.error("STATUS:", err.response.status);
    console.error("DATA:", err.response.data);
  } else {
    console.error(err.message);
  }

  res.status(500).json({
    error: err.response?.data || err.message
  });

  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
});
const path = require("path");

// ECG Forwarder state
let lastEcgHeartbeat = null;
let ecgConfig = {
  watchDir: "",
  orthancUrl: ""
};

const LOG_FILE_PATH = path.join(__dirname, "../tmp/ecg-logs.json");

function readLogs() {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(LOG_FILE_PATH, "utf8"));
    }
  } catch (err) {
    console.error("Error reading ECG logs file:", err.message);
  }
  return [];
}

function writeLogs(logs) {
  try {
    const trimmed = logs.slice(0, 200); // Keep 200 most recent logs
    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(trimmed, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing ECG logs file:", err.message);
  }
}

// Routes for ECG Forwarder Monitor
router.post("/ecg-heartbeat", (req, res) => {
  lastEcgHeartbeat = Date.now();
  if (req.body.watchDir) ecgConfig.watchDir = req.body.watchDir;
  if (req.body.orthancUrl) ecgConfig.orthancUrl = req.body.orthancUrl;
  res.json({ status: "ok" });
});

router.get("/ecg-status", (req, res) => {
  const isOnline = lastEcgHeartbeat && (Date.now() - lastEcgHeartbeat < 25000); // 25 seconds tolerance
  res.json({
    status: isOnline ? "active" : "offline",
    lastHeartbeat: lastEcgHeartbeat,
    config: ecgConfig
  });
});

router.post("/ecg-log", (req, res) => {
  const { timestamp, level, filename, nomor_pelayanan, status, message } = req.body;
  const newLog = {
    id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
    timestamp: timestamp || new Date().toISOString(),
    level: level || "INFO",
    filename: filename || "-",
    nomor_pelayanan: nomor_pelayanan || "-",
    status: status || "info", // "success", "error", "warning", "info"
    message: message || ""
  };
  
  const logs = readLogs();
  logs.unshift(newLog); // Add to beginning (newest first)
  writeLogs(logs);
  
  res.json({ status: "ok", log: newLog });
});

router.get("/patient-view", async (req, res) => {
  const patientID = req.query.patientID;
  if (!patientID) {
    return res.status(400).json({ error: "patientID is required" });
  }

  try {
    const ORTHANC_URL = process.env.ORTHANC_URL || "http://10.9.23.18:8042";
    const ORTHANC_USERNAME = process.env.ORTHANC_USERNAME || "orthanc";
    const ORTHANC_PASSWORD = process.env.ORTHANC_PASSWORD || "orthanc";

    // 1. Find studies in Orthanc
    console.log(`[PACS patient-view] Finding studies for PatientID: ${patientID}`);
    const findResponse = await axios.post(`${ORTHANC_URL}/tools/find`, {
      Level: "Study",
      Query: { PatientID: patientID },
      Expand: true
    }, {
      auth: {
        username: ORTHANC_USERNAME,
        password: ORTHANC_PASSWORD
      }
    });

    const studies = findResponse.data;
    if (!studies || studies.length === 0) {
      return res.status(404).json({ error: `Pasien dengan ID ${patientID} tidak ditemukan di PACS/Orthanc` });
    }

    // Sort studies to locate the most recent one (StudyDate desc, then StudyTime desc)
    studies.sort((a, b) => {
      const dateA = (a.MainDicomTags?.StudyDate || "") + (a.MainDicomTags?.StudyTime || "");
      const dateB = (b.MainDicomTags?.StudyDate || "") + (b.MainDicomTags?.StudyTime || "");
      return dateB.localeCompare(dateA);
    });

    const latestStudy = studies[0];
    const studyID = latestStudy.ID;

    // 2. Call the external decode-dicom study-analysis endpoint
    const DICOM_ANALYSIS_URL = process.env.DICOM_ANALYSIS_URL || "http://10.9.23.18:4000/api/decode-dicom/study-analysis";
    const VISMED_AI_URL = process.env.VISMED_AI_URL || "http://10.0.1.200:3000/ai/dicom-analysis";

    console.log(`[PACS patient-view] Calling study-analysis for Study ID: ${studyID}`);
    try {
      const analysisResponse = await axios.post(DICOM_ANALYSIS_URL, {
        orthancStudyId: studyID,
        aiUrl: VISMED_AI_URL,
        skipDicomContext: true,
        returnDecodedStudy: true
      }, {
        timeout: 90000 // 90 seconds timeout
      });

      res.json({
        study: latestStudy,
        analysis: analysisResponse.data
      });
    } catch (analysisErr) {
      console.error("[PACS patient-view] Study analysis failed, falling back to raw metadata:", analysisErr.message);
      // Fallback: return study metadata and empty instances so UI doesn't crash
      res.json({
        study: latestStudy,
        analysis: {
          decodedStudy: {
            studyMetadata: latestStudy.MainDicomTags || {},
            instances: []
          },
          onnxResult: null,
          aiResponse: null,
          error: `Gagal memproses detail citra (Decode server error: ${analysisErr.message})`
        }
      });
    }

  } catch (err) {
    console.error("[PACS patient-view] Error:", err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

router.get("/ecg-logs", (req, res) => {
  const logs = readLogs();
  res.json(logs);
});

module.exports = router;

