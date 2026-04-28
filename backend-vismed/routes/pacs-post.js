var express = require("express");
var router = express.Router();
var axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
const fs = require("fs");
const upload = multer({ dest: "tmp/" });
const PACS_URL = process.env.PACS_URL;

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
//http://10.9.23.18:4000/api/mwl
router.get("/get-mwl", async function (req, res) {
  try {
    const response = await axios.get(`http://10.9.23.18:4000/api/mwl`);

    res.json(response.data);

  } catch (err) {
    console.log("MWL ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// router.post("/upload-images", async (req, res) => {
//   try {
//     const response = await axios({
//       method: "post",
//       url: "http://10.9.23.18/api/upload-images",

//       data: req, // 🔥 kirim stream, bukan req.body

//       headers: {
//         "content-type": req.headers["content-type"], 
//       },

//       maxContentLength: Infinity,
//       maxBodyLength: Infinity
//     });

//     res.json(response.data);

//   } catch (err) {
//     console.error("UPLOAD ERROR:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// });

// router.post("/upload-videos", async (req, res) => {
//   try {
//     const response = await axios({
//       method: "post",
//       url: "http://10.9.23.18:4000/api/upload-video",

//       data: req, // 🔥 kirim stream, bukan req.body

//       headers: {
//         ...req.headers,
//       },

//       maxContentLength: Infinity,
//       maxBodyLength: Infinity
//     });

//     res.json(response.data);

//   } catch (err) {
//     console.error("UPLOAD ERROR:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// });

router.post("/upload-videos", upload.single("video"), async (req, res) => {
  let tempPath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video uploaded" });
    }

    console.log("WINDOWS FILE:", req.file);
    console.log("WINDOWS BODY:", req.body);

    const form = new FormData();

    form.append("video", fs.createReadStream(req.file.path));
    form.append("patientID", req.body.patientID);
    form.append("name", req.body.name);
    form.append("modality", req.body.modality);
    form.append("bodypart", req.body.bodypart);
    form.append("date", req.body.date);
    form.append("time", req.body.time);

    const response = await axios.post(
      "http://10.9.23.18:4000/api/upload-video",
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