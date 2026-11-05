const express = require("express"); const multer = require("multer"); const fs = require("fs"); const path = 
require("path"); const { execSync, spawnSync } = require("child_process");
 
const router = express.Router();
const upload = multer({ dest: "/tmp", limits: { fileSize: 500 * 1024 * 1024 } });
 
const ORTHANC_HOST  = "127.0.0.1";
const ORTHANC_PORT  = "4242";
const ORTHANC_REST_PORT = "8042";
const ORTHANC_USER      = "orthanc";
const ORTHANC_PASS      = "orthanc";
const PY_SCRIPT_PATH = path.join(__dirname, "make_video_dicom.py"); // file Python terpisah
 
// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
 
function generateUID() {
  const ts   = BigInt(Date.now());
  const rand = BigInt(Math.floor(Math.random() * 1e10));
  return "2.25." + (ts * BigInt(1e10) + rand).toString();
}
 
function safeStr(val) {
  return String(val || "")
    .replace(/\\/g, "")
    .replace(/"/g,  "")
    .replace(/\n/g, " ")
    .replace(/\r/g, "")
    .trim();
}
 
function normalizeDate(val) {
  const s = String(val || "").replace(/[-\/\.]/g, "").trim();
  if (s.length === 8 && /^\d{8}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}
 
function normalizeTime(val) {
  const s = String(val || "").replace(/[:.]/g, "").trim();
  if (s.length >= 6 && /^\d{6}/.test(s)) return s.slice(0, 6);
  return new Date().toTimeString().slice(0, 8).replace(/:/g, "");
}
 
function probeVideo(videoPath) {
  const r = spawnSync("ffprobe", [
    "-v", "quiet", "-print_format", "json", "-show_streams", videoPath
  ]);
  if (r.status !== 0) throw new Error("ffprobe gagal — pastikan ffmpeg terinstall");
 
  const info = JSON.parse(r.stdout.toString());
  const vs   = info.streams.find(s => s.codec_type === "video");
  if (!vs) throw new Error("Tidak ada video stream");
 
  const [fpsN, fpsD] = (vs.r_frame_rate || "25/1").split("/").map(Number);
  const fps         = fpsD ? fpsN / fpsD : 25;
  const width       = vs.width  || 512;
  const height      = vs.height || 512;
  const duration    = parseFloat(vs.duration || 0);
  const totalFrames = vs.nb_frames
    ? parseInt(vs.nb_frames)
    : Math.max(1, Math.round(duration * fps));
 
  return { width, height, fps, duration, totalFrames };
}
 
// ─────────────────────────────────────────────────────────────
// ROUTE
// ─────────────────────────────────────────────────────────────
router.post("/upload-video", upload.single("video"), async (req, res) => {
  const inputPath = req.file?.path;
  if (!inputPath) return res.status(400).json({ error: "No video uploaded" });
 
  const mp4Path = inputPath + "_h264.mp4";
  const dcmPath = inputPath + "_output.dcm";
 
  try {
    // ── Ambil field dari form ─────────────────────────────────
    const {
      patientID          = "UNKNOWN",
      name               = "ANONYMOUS",
      patientDOB         = "",
      patientSex         = "",
      modality           = "OT",
      bodypart           = "",
      seriesDescription  = "Endoscopy Video",
      manufacturer       = "CUSTOM",
      modelName          = "VideoConverter",
      institution        = "",
      accessionNumber    = "",
      referringPhysician = "",
    } = req.body;
 
    const date = normalizeDate(req.body.date);
    const time = normalizeTime(req.body.time);
 
    const studyUID  = generateUID();
    const seriesUID = generateUID();
    const sopUID    = generateUID();
 
    console.log("─".repeat(50));
    console.log("Patient   :", safeStr(name), "/", safeStr(patientID));
    console.log("Modality  :", safeStr(modality), safeStr(bodypart));
    console.log("Date/Time :", date, time);
    console.log("Study UID :", studyUID);
    console.log("─".repeat(50));
 
    // ── STEP 1: Re-encode ke H.264 High Profile ───────────────
    console.log("[1/4] Re-encoding video to H.264...");
   /* execSync(
      `ffmpeg -y -i "${inputPath}" \
        -vcodec libx264 \
        -profile:v high \
        -level:v 4.1 \
        -pix_fmt yuv420p \
        -crf 18 \
        -movflags +faststart \
        -an \
        "${mp4Path}"`,
      { stdio: "inherit" }
    );*/
    
execSync(
  `ffmpeg -y -i "${inputPath}" \
    -c:v libx264 \
    -profile:v high \
    -level 4.1 \
    -pix_fmt yuv420p \
    -movflags +faststart \
    -g 30 \
    -keyint_min 30 \
    -sc_threshold 0 \
    -bf 0 \
    -crf 18 \
    -an \
    "${mp4Path}"`,
  { stdio: "inherit" }
);
 
    // ── STEP 2: Probe video ───────────────────────────────────
    const { width, height, fps, duration, totalFrames } = probeVideo(mp4Path);
    console.log(`[2/4] Video: ${width}x${height} @ ${fps.toFixed(2)}fps, ${totalFrames} frames, ${duration.toFixed(1)}s`);
 
    // ── STEP 3: Buat DICOM via make_dicom.py ─────────────────
    // Semua data dikirim sebagai JSON via --params argument
    // Python membaca JSON → tidak ada risiko injection
    console.log("[3/4] Creating DICOM encapsulated video...");
 
    const params = JSON.stringify({
      mp4Path,
      dcmPath,
      studyUID,
      seriesUID,
      sopUID,
      width,
      height,
      fps,
      totalFrames,
      patientName:        safeStr(name),
      patientID:          safeStr(patientID),
      patientDOB:         safeStr(patientDOB),
      patientSex:         safeStr(patientSex),
      modality:           safeStr(modality).toUpperCase() || "OT",
      bodypart:           safeStr(bodypart).toUpperCase(),
      seriesDescription:  safeStr(seriesDescription),
      manufacturer:       safeStr(manufacturer),
      modelName:          safeStr(modelName),
      institution:        safeStr(institution),
      accessionNumber:    safeStr(accessionNumber),
      referringPhysician: safeStr(referringPhysician),
      date,
      time,
    });
 
    // Tulis params ke file sementara, Python baca dari file
    const paramsPath = inputPath + "_params.json";
    fs.writeFileSync(paramsPath, params);
 
    const pyResult = spawnSync(
      "/home/pacs/servers/runtime/venvs/dicom-gateway-convert/bin/python",
      [PY_SCRIPT_PATH, "--params", paramsPath],
      { encoding: "utf8" }
    );
 
    // Hapus file params
    try { fs.rmSync(paramsPath); } catch (_) {}
 
    if (pyResult.status !== 0) {
      console.error("[PYTHON ERROR]\n", pyResult.stderr);
      throw new Error("Python error: " + pyResult.stderr.slice(0, 400));
    }
 
    const pyOut = pyResult.stdout.trim();
    const parts = pyOut.split("|");
    if (parts[0] !== "OK") throw new Error("Python output unexpected: " + pyOut);
 
    const [, sizeMB, resolution, frameCount] = parts;
    console.log(`DICOM: ${sizeMB} MB, ${resolution}, ${frameCount} frames`);
 
    if (!fs.existsSync(dcmPath) || fs.statSync(dcmPath).size < 500) {
      throw new Error("DICOM file tidak terbuat atau terlalu kecil");
    }
 
    // ── STEP 4: Kirim ke Orthanc ──────────────────────────────
    console.log("[4/4] Sending to Orthanc...");
    /*execSync(
      `storescu -v +xn \
        --propose-mpeg4-422-level41 \
        -aec ORTHANC \
        ${ORTHANC_HOST} ${ORTHANC_PORT} \
        "${dcmPath}"`,
      { stdio: "inherit" }
    );*/
    const dcmBuffer  = fs.readFileSync(dcmPath);
    const orthancUrl = `http://${ORTHANC_HOST}:${ORTHANC_REST_PORT}/instances`;
    const authString = Buffer.from(`${ORTHANC_USER}:${ORTHANC_PASS}`).toString('base64');

    const orthancRes = await fetch(orthancUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/dicom", "Authorization": `Basic ${authString}` },
      body:    dcmBuffer,
    });
    if (!orthancRes.ok) {
      const errText = await orthancRes.text();
      throw new Error(`Orthanc error ${orthancRes.status}: ${errText}`);
    }
    const orthancJson = await orthancRes.json();
    console.log("Orthanc:", orthancJson.Status, "| ID:", orthancJson.ID)
 
    console.log("✅ Upload selesai!");
 
    res.json({
      status:  "OK",
      message: "DICOM Video berhasil dikirim ke Orthanc 🎬",
      dicom: {
        studyUID,
        seriesUID,
        sopUID,
        sopClass:       "1.2.840.10008.5.1.4.1.1.77.1.4.1",
        transferSyntax: "1.2.840.10008.1.2.4.102",
      },
      video: {
        resolution,
        frames:   parseInt(frameCount),
        fps:      parseFloat(fps.toFixed(2)),
        duration: parseFloat(duration.toFixed(1)),
        sizeMB,
      },
      patient: {
        name:  safeStr(name),
        id:    safeStr(patientID),
        dob:   safeStr(patientDOB),
        sex:   safeStr(patientSex),
      },
      study: {
        modality: safeStr(modality).toUpperCase(),
        bodypart: safeStr(bodypart).toUpperCase(),
        date,
        time,
      },
    });
 
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    for (const p of [inputPath, mp4Path, dcmPath]) {
      try { if (p && fs.existsSync(p)) fs.rmSync(p, { force: true }); } catch (_) {}
    }
  }
});
 
module.exports = router;
