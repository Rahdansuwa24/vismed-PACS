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
module.exports = router;
