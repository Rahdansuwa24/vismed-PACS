var express = require("express");
var router = express.Router();
var axios = require("axios");

const endpoint = process.env.ENDPOINT || process.env.endpoint;

router.post("/", function (req, res) {
  const data = req.body;

  const mwl = {
    PatientName: data.name,
    PatientID: data.id,
    Modality: data.modality,
    StudyDescription: data.study,
  };

  res.json(mwl);
});

router.get("/get-mwl", async function (req, res) {
  try {
    if (!endpoint) {
      return res.status(500).json({ error: "ENDPOINT belum dikonfigurasi" });
    }

    const response = await axios.get(`${endpoint}/mwl-get`);
    res.json(response.data);
  } catch (err) {
    console.log("MWL ERROR:", err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

module.exports = router;
