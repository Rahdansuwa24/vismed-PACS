const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { execSync } = require("child_process");
const axios = require("axios");
const FormData = require("form-data");

const router = express.Router();

const upload = multer({ dest: "/tmp",
	limits: {
    	fileSize: 5 * 1024 * 1024 // 5MB per file
     }
 });

const ORTHANC_URL = "http://localhost:8042";

router.post("/upload-images", upload.array("images", 500), async (req, res) => {
  try {

    const studyUID = req.body.studyUID || ("2.25." + Date.now());
    const seriesUID = req.body.seriesUID || ("2.25." + (Date.now() + 1));

    let i = 1;
    const results = [];
    
   
    for (const file of req.files) {
      const imgPath = file.path;
      const dcmPath = imgPath + ".dcm";

      // 🔥 convert image → DICOM
      execSync(`
        img2dcm \
	-k "StudyInstanceUID=${studyUID}" \
        -k "SeriesInstanceUID=${seriesUID}" \
        -k "SeriesNumber=1" \
        -k "InstanceNumber=${i}" \
        -k "ImagePositionPatient=0\\0\\${i}" \
        -k "ImageOrientationPatient=1\\0\\0\\0\\1\\0" \
        -k "SliceThickness=1" \
        -k "PatientName=${req.body.name}" \
        -k "PatientID=${req.body.patientID}" \
        -k "Modality=${req.body.modality}" \
        -k "StudyDescription=${req.body.bodypart}" \
        -k "StudyDate=${req.body.date}" \
        -k "StudyTime=${req.body.time}" \
        ${imgPath} ${dcmPath}
      `);

      // 🔥 upload ke Orthanc
      const form = new FormData();
      form.append("file", fs.createReadStream(dcmPath));

      const response = await axios.post(
        `${ORTHANC_URL}/instances`,
        form,
        {
          headers: form.getHeaders(),
          auth: {
            username: "orthanc",
            password: "orthanc"
          }
        }
      );

      results.push(response.data);
      i++;
    }

    res.json({
      status: "OK",
      total: results.length,
      data: results
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
