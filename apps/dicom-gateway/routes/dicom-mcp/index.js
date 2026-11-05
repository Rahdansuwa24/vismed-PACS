const express = require("express");
const router = express.Router();

const { callDicomTool, listTools } = require("../../services/dicomMcpClient");

router.get("/health", function (req, res) {
  res.json({
    status: "ok",
    service: "dicom-mcp-bridge",
  });
});

router.get("/tools", async function (req, res) {
  try {
    const result = await listTools();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/verify", async function (req, res) {
  try {
    const result = await callDicomTool("verify_connection");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/patients", async function (req, res) {
  try {
    const args = {};

    if (req.query.name) args.name_pattern = req.query.name;
    if (req.query.patientId) args.patient_id = req.query.patientId;
    if (req.query.attributePreset) args.attribute_preset = req.query.attributePreset;

    const result = await callDicomTool("query_patients", args);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/studies", async function (req, res) {
  try {
    const args = {};

    if (req.query.patientId) args.patient_id = req.query.patientId;
    if (req.query.studyDate) args.study_date = req.query.studyDate;
    if (req.query.modality) args.modality_in_study = req.query.modality;
    if (req.query.accessionNumber) args.accession_number = req.query.accessionNumber;
    if (req.query.studyInstanceUid) args.study_instance_uid = req.query.studyInstanceUid;

    const result = await callDicomTool("query_studies", args);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/tool", async function (req, res) {
  try {
    const { name, args = {} } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Tool name wajib diisi" });
    }

    const result = await callDicomTool(name, args);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
