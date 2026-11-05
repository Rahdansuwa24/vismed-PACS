const express = require("express");
const fs = require("fs");
const { execSync } = require("child_process");

const router = express.Router();

const WORKLIST_DIR = "/var/lib/orthanc/worklists";

// 🔧 Helper
function formatDate(d) {
  return (d || "2000-01-01").replaceAll("-", "");
}

// Format Time
function formatTime(t) {
  if (!t) return "100000";
  const clean = t.replaceAll(":", "");
  return clean.padEnd(6, "0"); // wajib HHMMSS
}

// Format Name
function formatName(name) {
  return (name || "TEST PATIENT")
    .trim()
    .replace(/\s+/g, "^");
}

// Endpoint
router.post("/mwl-post", (req, res) => {
  const data = req.body;

  console.log("DATA MASUK:", data);

  try {
    const uid = `1.2.826.0.1.3680043.2.1125.${Date.now()}.${Math.floor(Math.random()*100000)}`;
    const fileName = data.accessionNumber ? `mwl-${data.accessionNumber}` : `mwl-${Date.now()}`;

    const txtPath = `/tmp/${fileName}.txt`;
    const wlPath = `${WORKLIST_DIR}/${fileName}.wl`;

    // Hapus berkas lama dengan nomor aksesi yang sama agar tidak duplikat
    if (data.accessionNumber) {
      try {
        const files = fs.readdirSync(WORKLIST_DIR);
        for (const file of files) {
          if (file.endsWith(".wl") && file !== `${fileName}.wl`) {
            const filePath = `${WORKLIST_DIR}/${file}`;
            const buf = fs.readFileSync(filePath);
            if (buf.includes(data.accessionNumber)) {
              fs.unlinkSync(filePath);
              console.log("Menghapus berkas duplikat lama:", file);
            }
          }
        }
      } catch (err) {
        console.error("Gagal membersihkan duplikat:", err.message);
      }
    }

    const birthDate = formatDate(data.birthDate);
    const scheduleDate = formatDate(data.scheduleDate);
    const scheduleTime = formatTime(data.scheduleTime);

    const patientName = formatName(data.patientName);
    const technologistName = formatName(data.technologist1 || "DOC^TEST");
    const radiologistName = formatName(data.radiologist || "DOC^TEST");
    const room = data.room || "ROOM1";

    const content = `
(0008,0016) UI [1.2.840.10008.5.1.4.31]
(0008,0052) CS [WORKLIST]

(0008,0060) CS [${data.modality || "CT"}]
(0008,0050) SH [${data.accessionNumber || "ACC001"}]

(0010,0010) PN [${patientName}]
(0010,0020) LO [${data.patientID || "P001"}]
(0010,0030) DA [${birthDate}]
(0010,0040) CS [${data.sex || "M"}]

(0032,1060) LO [${data.procedureDesc || "CT SCAN"}]

(0040,0100) SQ
  (fffe,e000)
    (0008,0060) CS [${data.modality || "CT"}]
    (0040,0001) AE [${data.aet || "MODALITY1"}]
    (0040,0002) DA [${scheduleDate}]
    (0040,0003) TM [${scheduleTime}]
    (0040,0006) PN [${radiologistName}]
    (0040,0010) LO [${room}]
    (0040,0007) LO [${data.procedureDesc || "CT SCAN"}]
    (0040,0009) SH [SPS${Date.now()}]
  (fffe,e00d)
(fffe,e0dd)
`;

    // Simpan TXT
    fs.writeFileSync(txtPath, content);

    // Convert ke DICOM (.wl)
    execSync(`/usr/bin/dump2dcm -g ${txtPath} ${wlPath}`, {
      stdio: "inherit",
    });

    console.log("MWL dibuat:", wlPath);

    res.send({
      status: "OK",
      file: wlPath
    });

  } catch (err) {
    console.error("ERROR DICOM:", err.message);
    res.status(500).send("Gagal convert DICOM");
  }
});

module.exports = router;
