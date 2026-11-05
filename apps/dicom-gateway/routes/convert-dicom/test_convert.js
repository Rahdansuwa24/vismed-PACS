const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ORTHANC_HOST = "127.0.0.1";
const ORTHANC_REST_PORT = "8042";
const ORTHANC_USER = "orthanc";
const ORTHANC_PASS = "orthanc";

const PY_SCRIPT_PATH = "/home/pacs/servers/apps/dicom-gateway/routes/convert-dicom/make_video_dicom_jpeg.py";
const PYTHON_PATH = "/home/pacs/servers/runtime/venvs/dicom-gateway-convert/bin/python";

function generateUID() {
  const ts = BigInt(Date.now());
  const rand = BigInt(Math.floor(Math.random() * 1e10));
  return "2.25." + (ts * BigInt(1e10) + rand).toString();
}

function probeVideo(videoPath) {
  const r = spawnSync("ffprobe", [
    "-v", "quiet", "-print_format", "json", "-show_streams", videoPath
  ]);
  if (r.status !== 0) throw new Error("ffprobe failed - make sure ffmpeg is installed");

  const info = JSON.parse(r.stdout.toString());
  const vs = info.streams.find(s => s.codec_type === "video");
  if (!vs) throw new Error("No video stream found");

  const [fpsN, fpsD] = (vs.r_frame_rate || "25/1").split("/").map(Number);
  const fps = fpsD ? fpsN / fpsD : 25;
  const width = vs.width || 512;
  const height = vs.height || 512;
  const duration = parseFloat(vs.duration || 0);
  const totalFrames = vs.nb_frames
    ? parseInt(vs.nb_frames)
    : Math.max(1, Math.round(duration * fps));

  return { width, height, fps, duration, totalFrames };
}

async function run() {
  const videoPath = "/tmp/X-Ray-Retrospective.mp4";
  const tempDir = "/tmp/test_frames";
  const dcmPath = "/tmp/test_output.dcm";

  if (!fs.existsSync(videoPath)) {
    console.error(`Error: test video not found at ${videoPath}`);
    process.exit(1);
  }

  // 1. Probe video
  console.log("Probing video...");
  const { width, height, fps, totalFrames } = probeVideo(videoPath);
  console.log(`Video info: ${width}x${height} @ ${fps.toFixed(2)}fps, ${totalFrames} frames`);

  // 2. Re-create temp folder
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir);

  // 3. Extract frames
  console.log("Extracting frames using ffmpeg...");
  execSync(`ffmpeg -y -i "${videoPath}" -q:v 2 "${tempDir}/frame_%04d.jpg"`, { stdio: "ignore" });

  const files = fs.readdirSync(tempDir)
    .filter(f => f.startsWith("frame_") && f.endsWith(".jpg"))
    .sort()
    .map(f => path.join(tempDir, f));

  console.log(`Extracted ${files.length} frames.`);

  // 4. Generate UIDs
  const studyUID = generateUID();
  const seriesUID = generateUID();
  const sopUID = generateUID();

  // Create formatted date and time
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");

  console.log("==========================================");
  console.log(`StudyInstanceUID : ${studyUID}`);
  console.log(`SeriesInstanceUID: ${seriesUID}`);
  console.log(`SOPInstanceUID   : ${sopUID}`);
  console.log("==========================================");

  // Prepare parameters JSON
  const params = {
    jpegPaths: files,
    dcmPath,
    studyUID,
    seriesUID,
    sopUID,
    width,
    height,
    fps,
    patientName: "TEST_VIDEO_US1",
    patientID: "TEST_VIDEO_US1",
    modality: "US",
    date,
    time,
  };

  const paramsPath = "/tmp/params.json";
  fs.writeFileSync(paramsPath, JSON.stringify(params));

  // 5. Spawn Python script to convert
  console.log("Compiling single multi-frame DICOM file with JPEG Baseline...");
  const pyResult = spawnSync(PYTHON_PATH, [PY_SCRIPT_PATH, "--params", paramsPath], { encoding: "utf8" });

  // Clean up params file
  try { fs.rmSync(paramsPath); } catch (_) { }

  if (pyResult.status !== 0) {
    console.error(`[Conversion Error]`, pyResult.stderr);
    throw new Error(`Failed to convert video to multi-frame DICOM`);
  }

  if (!fs.existsSync(dcmPath)) {
    throw new Error(`DICOM file not created at ${dcmPath}`);
  }

  console.log(`DICOM created successfully. Size: ${(fs.statSync(dcmPath).size / 1024 / 1024).toFixed(2)} MB`);

  // 6. Upload to Orthanc
  console.log("Uploading multi-frame DICOM to Orthanc...");
  const authString = Buffer.from(`${ORTHANC_USER}:${ORTHANC_PASS}`).toString('base64');
  const orthancUrl = `http://${ORTHANC_HOST}:${ORTHANC_REST_PORT}/instances`;

  const dcmBuffer = fs.readFileSync(dcmPath);
  const orthancRes = await fetch(orthancUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/dicom",
      "Authorization": `Basic ${authString}`
    },
    body: dcmBuffer,
  });

  if (!orthancRes.ok) {
    const errText = await orthancRes.text();
    throw new Error(`Orthanc upload failed: ${errText}`);
  }

  const resJson = await orthancRes.json();
  console.log("Orthanc Response:", resJson);

  // Final cleanup
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(dcmPath, { force: true });
  } catch (_) { }

  console.log("==========================================");
  console.log("✅ Conversion and upload finished successfully!");
  console.log(`StudyInstanceUID for viewer: ${studyUID}`);
  console.log("==========================================");
}

run().catch(err => {
  console.error("❌ Process failed:", err);
  process.exit(1);
});
