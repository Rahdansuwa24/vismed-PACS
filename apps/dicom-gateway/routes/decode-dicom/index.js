const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const FormData = require("form-data");
const axios = require("axios");
const multer = require("multer");
const upload = multer({ dest: os.tmpdir() });

const router = express.Router();

const PY_SCRIPT_PATH = path.join(__dirname, "extract_study_context.py");
const DEFAULT_PYTHON = "/home/pacs/servers/runtime/venvs/dicom-gateway-convert/bin/python";

function safeInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function runExtractor(payload) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "decode-dicom-"));
  const paramsPath = path.join(tempDir, "params.json");

  try {
    fs.writeFileSync(paramsPath, JSON.stringify(payload));

    const pythonBin = process.env.DECODE_DICOM_PYTHON || DEFAULT_PYTHON;
    const result = spawnSync(
      pythonBin,
      [PY_SCRIPT_PATH, "--params", paramsPath],
      {
        encoding: "utf8",
        maxBuffer: 25 * 1024 * 1024,
      }
    );

    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || "Python extractor failed").slice(0, 1000));
    }

    return JSON.parse(result.stdout);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) { }
  }
}

function selectedDebugFields(decodedStudy) {
  return {
    selectedOrthancStudyId: decodedStudy.selectedOrthancStudyId || decodedStudy.orthancStudyId,
    selectedStudyInstanceUid: decodedStudy.selectedStudyInstanceUid || decodedStudy.studyInstanceUid,
    selectedOrthancSeriesId: decodedStudy.selectedOrthancSeriesId,
    selectedInstanceIds: decodedStudy.selectedInstanceIds || [],
    selectedSeriesDescriptions: decodedStudy.selectedSeriesDescriptions || [],
    selectedBodyParts: decodedStudy.selectedBodyParts || [],
    selectedIndexes: decodedStudy.selectedIndexes || [],
    selectedSeriesCandidates: decodedStudy.selectedSeriesCandidates || [],
    warning: decodedStudy.warning,
    warnings: decodedStudy.warnings || [],
  };
}

function collectImages(decodedStudy) {
  const images = [];
  const studyMetadata = decodedStudy.studyMetadata || {};
  const isStudyEcg = String(studyMetadata.Modality || "").toUpperCase().trim() === "ECG";

  for (const instance of decodedStudy.instances || []) {
    if (isStudyEcg || instance.metadata?.Modality === "ECG" || instance.mediaType === "waveform") {
      images.push({
        mimeType: "application/dicom",
        data: null,
        mediaType: "waveform",
        orthancInstanceId: instance.orthancInstanceId,
        source: {
          orthancInstanceId: instance.orthancInstanceId,
          index: instance.index,
          selectedIndex: instance.selectedIndex,
          seriesDescription: instance.metadata?.SeriesDescription,
          bodyPartExamined: instance.metadata?.BodyPartExamined,
        },
      });
      continue;
    }

    const videoFrames = instance.videoFramePngBase64 || [];

    if (videoFrames.length) {
      for (const frame of videoFrames) {
        images.push({
          mimeType: instance.mimeType || "image/png",
          data: frame,
          mediaType: "video-frame",
          source: {
            orthancInstanceId: instance.orthancInstanceId,
            index: instance.index,
            selectedIndex: instance.selectedIndex,
            seriesDescription: instance.metadata?.SeriesDescription,
            bodyPartExamined: instance.metadata?.BodyPartExamined,
          },
        });
      }
      continue;
    }

    if (instance.imagePngBase64) {
      images.push({
        mimeType: instance.mimeType || "image/png",
        data: instance.imagePngBase64,
        mediaType: instance.mediaType || "image",
        source: {
          orthancInstanceId: instance.orthancInstanceId,
          index: instance.index,
          selectedIndex: instance.selectedIndex,
          seriesDescription: instance.metadata?.SeriesDescription,
          bodyPartExamined: instance.metadata?.BodyPartExamined,
        },
      });
    }
  }

  return images;
}

async function analyzeWithOnnx(images, domain = "xray") {
  try {
    const form = new FormData();
    form.append("domain", domain);
    form.append("metadata", JSON.stringify({ source: "pacs-orchestrator" }));
    console.log("[analyzeWithOnnx] Sending to ONNX vision, domain:", domain, "images:", images.length);

    for (let i = 0; i < images.length; i++) {
      let buffer;
      let mime = images[i].mimeType || "image/png";
      let filename = `frame_${i}.${mime.split("/")[1] || "png"}`;

      if (["ecg", "ct_brain", "ct_chest", "xray"].includes(domain) || images[i].mediaType === "waveform") {
        const orthancUrl = process.env.ORTHANC_URL || "http://127.0.0.1:8042";
        const username = process.env.ORTHANC_USER || "orthanc";
        const password = process.env.ORTHANC_PASS || "orthanc";
        const auth_b64 = Buffer.from(`${username}:${password}`).toString("base64");

        const instanceId = images[i].orthancInstanceId || images[i].source?.orthancInstanceId;
        const fileResponse = await axios.get(`${orthancUrl}/instances/${instanceId}/file`, {
          headers: { Authorization: `Basic ${auth_b64}` },
          responseType: "arraybuffer",
          timeout: 15000,
        });

        buffer = Buffer.from(fileResponse.data);
        mime = "application/dicom";
        filename = `${domain}_${i}.dcm`;
      } else {
        buffer = Buffer.from(images[i].data, "base64");
      }

      form.append("files", buffer, {
        filename: filename,
        contentType: mime,
      });
    }

    const onnxResponse = await axios.post("http://127.0.0.1:5000/analyze", form, {
      headers: form.getHeaders(),
      maxContentLength: 80 * 1024 * 1024,
      maxBodyLength: 80 * 1024 * 1024,
      timeout: 25000,
    });

    return onnxResponse.data;
  } catch (error) {
    const detail = error.response?.data?.detail || error.response?.data || error.message;
    console.error("ONNX Vision service error:", { domain, detail, status: error.response?.status });
    return { status: "error", error: typeof detail === "string" ? detail : JSON.stringify(detail), domain };
  }
}

function buildAnalysisPrompt(userPrompt, decodedStudy, onnxFindingsText) {
  const prompt = userPrompt || "Berikan kesimpulan hasil pemeriksaan dari study DICOM ini berdasarkan metadata dan gambar yang tersedia.";

  return [
    prompt,
    "",
    "Gunakan konteks DICOM berikut sebagai dasar analisis.",
    decodedStudy.contextText || "",
    "",
    onnxFindingsText ? `Hasil Temuan Analisis AI Vision (ONNX):\n${onnxFindingsText}\n` : "",
    "Tulis jawaban dalam bahasa Indonesia. Jelaskan temuan visual yang tampak, keterbatasan analisis AI, dan jangan menyatakan diagnosis final tanpa validasi dokter/radiolog.",
  ].join("\n");
}

function stripImageData(decodedStudy) {
  return {
    ...decodedStudy,
    instances: (decodedStudy.instances || []).map((instance) => ({
      ...instance,
      imagePngBase64: instance.imagePngBase64 ? `[omitted:${instance.imagePngBase64.length}]` : undefined,
      videoFramePngBase64: instance.videoFramePngBase64
        ? instance.videoFramePngBase64.map((frame) => `[omitted:${frame.length}]`)
        : undefined,
    })),
  };
}

async function postToAi(aiUrl, payload) {
  const response = await fetch(aiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { raw: text };
  }

  if (!response.ok) {
    const detail = typeof data === "object" ? JSON.stringify(data).slice(0, 1000) : String(data).slice(0, 1000);
    throw new Error(`AI endpoint error ${response.status}: ${detail}`);
  }

  return data;
}

function buildExtractorPayload(reqBody, forceImages) {
  return {
    studyInstanceUid: reqBody?.studyInstanceUid,
    orthancStudyId: reqBody?.orthancStudyId,
    includeImages: forceImages ? true : Boolean(reqBody?.includeImages ?? true),
    maxImages: safeInt(reqBody?.maxImages, 6, 1, 12),
    maxVideoFrames: safeInt(reqBody?.maxVideoFrames, 3, 1, 8),
    imageFormat: reqBody?.imageFormat || (reqBody?.aiCompactImages ? "jpeg" : "png"),
    maxDimension: safeInt(reqBody?.maxDimension, reqBody?.aiCompactImages ? 384 : 1024, 128, 1024),
    jpegQuality: safeInt(reqBody?.jpegQuality, 70, 30, 95),
    orthanc: {
      url: process.env.ORTHANC_URL || "http://127.0.0.1:8042",
      username: process.env.ORTHANC_USER || "orthanc",
      password: process.env.ORTHANC_PASS || "orthanc",
    },
  };
}

router.get("/health", function (req, res) {
  res.json({
    status: "ok",
    service: "decode-dicom",
  });
});

router.post("/study-context", function (req, res) {
  try {
    const {
      studyInstanceUid,
      orthancStudyId,
      includeImages = true,
    } = req.body || {};

    if (!studyInstanceUid && !orthancStudyId) {
      return res.status(400).json({
        error: "studyInstanceUid atau orthancStudyId wajib diisi",
      });
    }

    const payload = buildExtractorPayload(req.body, false);

    const result = runExtractor(payload);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/study-analysis", async function (req, res) {
  try {
    const { studyInstanceUid, orthancStudyId } = req.body || {};

    if (!studyInstanceUid && !orthancStudyId) {
      return res.status(400).json({
        error: "studyInstanceUid atau orthancStudyId wajib diisi",
      });
    }

    const decodedStudy = runExtractor(buildExtractorPayload(req.body, true));
    const images = collectImages(decodedStudy);

    if (!images.length) {
      return res.status(422).json({
        error: "Decode berhasil, tetapi tidak ada gambar/frame PNG yang bisa dikirim ke AI",
        ...selectedDebugFields(decodedStudy),
        decodedStudy: stripImageData(decodedStudy),
      });
    }

    // Call ONNX Vision Service to analyze images
    const metadata = decodedStudy.studyMetadata || {};
    const instances = decodedStudy.instances || [];
    const instanceMeta = instances[0]?.metadata || {};

    // Modality is often at instance/series level, not study level
    const modality = String(instanceMeta.Modality || metadata.Modality || "").toUpperCase().trim();
    const bodyPart = String(instanceMeta.BodyPartExamined || metadata.BodyPartExamined || "").toUpperCase().trim();
    const studyDesc = String(metadata.StudyDescription || "").toUpperCase().trim();
    const seriesDesc = String(instanceMeta.SeriesDescription || "").toUpperCase().trim();
    const combined = `${studyDesc} ${bodyPart} ${seriesDesc}`;

    let domain = req.body.domain || null; // check if domain override is requested
    let domainMismatchNote = "";

    let effectiveModality = modality
      || (studyDesc.startsWith("CT ") || studyDesc.includes(" CT ") || studyDesc.includes("CT/") || studyDesc.includes("/CT") ? "CT" : "")
      || (studyDesc.startsWith("MR ") || studyDesc.includes(" MR ") || studyDesc.includes("MRI") ? "MR" : "");

    // Determine domain automatically only if not explicitly overridden by client
    if (!req.body.domain) {
      // Helper: detect body region from combined description fields
      const isWholeBody = /WHOLE BODY|TOTAL BODY|SKULL BASE TO MID-THIGH|SKULL BASE TO MID THIGH|PET-CT|PET CT|\bWB\b/.test(combined);
      const isBrain = /HEAD|BRAIN|SKULL|CRANIAL|CEREBR/.test(combined);
      const isChest = /CHEST|LUNG|THORAX|THORAC|PULMON|ANGIOGRAPH/.test(combined);
      const isAbdomen = /ABDOMEN|ABDOMINAL|PELVI|LIVER|KIDNEY|RENAL|SPLEEN|PANCREA/.test(combined);
      const isExtremity = /THIGH|FEMUR|TIBIA|EXTREM|SPINE|LUMBAR|CERVICAL|HIP|KNEE|ANKLE|SHOULDER|ARM|LEG|FOOT|HAND/.test(combined);

      if (effectiveModality === "CT" || effectiveModality === "MR" || effectiveModality === "MRI") {
        if (isWholeBody) {
          // Wide-range scan — bypass ONNX and rely directly on MedGemma visual analysis
          domain = null;
          domainMismatchNote = `Studi ini merupakan pemindaian area luas (Whole Body/PET-CT). Analisis dialihkan untuk dianalisis secara visual langsung oleh MedGemma karena mencakup banyak area tubuh.`;
        } else {
          // Prioritize BodyPartExamined (specific series-level metadata)
          const bodyPartChest = /CHEST|LUNG|THORAX|THORAC|PULMON/.test(bodyPart);
          const bodyPartBrain = /HEAD|BRAIN|SKULL|CRANIAL|CEREBR/.test(bodyPart);

          if (bodyPartChest) {
            if (/NODUL|NODULE|SOLITER|MONAI/.test(combined)) {
              domain = "ct_chest_nodule";
            } else {
              domain = "ct_chest";
            }
          } else if (bodyPartBrain) {
            if (/STROKE|INFARK|ISKEMIK|LCNN|BEIT/.test(combined)) {
              domain = "ct_brain_stroke";
            } else {
              domain = "ct_brain";
            }
          } else if (isChest) { // Fallback to combined text checking if BodyPartExamined is generic/empty
            if (/NODUL|NODULE|SOLITER|MONAI/.test(combined)) {
              domain = "ct_chest_nodule";
            } else {
              domain = "ct_chest";
            }
          } else if (isBrain) {
            if (/STROKE|INFARK|ISKEMIK|LCNN|BEIT/.test(combined)) {
              domain = "ct_brain_stroke";
            } else {
              domain = "ct_brain";
            }
          } else if (isAbdomen || isExtremity) {
            // No specific model — let MedGemma handle it visually
            domain = null;
            domainMismatchNote = `Tidak ada model AI Vision yang terkonfigurasi untuk area tubuh ini (${studyDesc || bodyPart || "Umum"}).`;
          } else {
            // Unknown area — default to null to bypass ONNX and rely on MedGemma
            domain = null;
            domainMismatchNote = `Tidak dapat menentukan area tubuh secara spesifik dari deskripsi studi "${studyDesc}".`;
          }
        }
      } else if (effectiveModality === "ES") {
        domain = "endoscopy";
      } else if (effectiveModality === "ECG" || effectiveModality === "EKG") {
        domain = "ecg";
      } else if (["CR", "DX", "PX", "XA"].includes(effectiveModality)) {
        // Dynamic routing for X-Ray: check if it is Tuberculosis-related
        if (/TB|TBC|TUBERCULOSIS|FLEK/.test(combined)) {
          domain = "xray_tuberculosis";
        } else {
          domain = "xray";
        }
      } else {
        // Modality unknown or not supported by ONNX
        domain = null;
      }
    }

    console.log("[study-analysis] Domain mapping:", { modality, effectiveModality, bodyPart, studyDesc, domain, mismatch: domainMismatchNote || "none" });

    let onnxResult = null;
    let onnxFindingsText = "";
    if (domain) {
      try {
        onnxResult = await analyzeWithOnnx(images, domain);
        if (onnxResult && onnxResult.status === "ok" && onnxResult.analyzedFiles) {
          const findingsList = [];

          // Deteksi mismatch otomatis berdasarkan confidence rendah
          // Jika temuan teratas adalah penyakit (bukan Normal) tapi confidence < 0.65
          // → kemungkinan model diaplikasikan ke gambar yang salah domain
          let autoMismatchDetected = false;
          for (const file of onnxResult.analyzedFiles) {
            if (file.findings && file.findings.length > 0) {
              const sorted = [...file.findings].sort((a, b) => b.confidence - a.confidence);
              const top = sorted[0];
              const isNormal = (top.label || "").toLowerCase() === "normal";
              const maxConf = top.confidence;
              // Jika tidak ada satu pun temuan yang meyakinkan (semua < 0.65)
              const allLowConf = sorted.every(f => f.confidence < 0.65);
              if (allLowConf && !isNormal) {
                autoMismatchDetected = true;
              }
            }
          }

          for (const file of onnxResult.analyzedFiles) {
            if (file.findings && file.findings.length > 0) {
              const sorted = [...file.findings].sort((a, b) => b.confidence - a.confidence);
              const fileFindings = sorted.map(f => {
                const labelLower = f.label.toLowerCase();
                const pct = f.confidence * 100;
                let qualitative;
                if (labelLower === "normal" || labelLower === "norm") {
                  qualitative = pct >= 70
                    ? "Kondisi diindikasikan Normal"
                    : "Kondisi tidak dapat ditentukan dengan jelas";
                } else {
                  qualitative = pct >= 70
                    ? `Indikasi kuat ${f.label}`
                    : pct >= 50
                      ? `Ada indikasi ${f.label}, perlu evaluasi lebih lanjut`
                      : `Temuan minor ${f.label}, tidak cukup spesifik`;
                }
                return `- ${qualitative}`;
              }).join("\n");
              findingsList.push(fileFindings);
            }
          }
          if (findingsList.length > 0) {
            onnxFindingsText = `Model AI Vision (${domain}):\n` + findingsList.join("\n\n");
          } else {
            onnxFindingsText = `Model AI Vision (${domain}): Tidak ditemukan kelainan signifikan oleh AI Vision (ONNX).`;
          }

          // Mismatch dari metadata domain (set sebelumnya)
          if (domainMismatchNote) {
            onnxFindingsText += `\n\nPeringatan Mismatch Model: ${domainMismatchNote}`;
          }
          // Mismatch otomatis dari confidence rendah
          if (autoMismatchDetected && !domainMismatchNote) {
            onnxFindingsText += `\n\nPeringatan Mismatch Model: Semua nilai keyakinan model AI Vision rendah, yang mengindikasikan bahwa model mungkin tidak sesuai dengan jenis atau area gambar yang dianalisis. Hasil ONNX perlu diinterpretasikan dengan hati-hati.`;
          }
        } else if (onnxResult && onnxResult.status === "domain_mismatch") {
          onnxFindingsText = `Peringatan Mismatch Kritis: ${onnxResult.warning || "Citra visual tidak sesuai dengan jenis pemeriksaan model AI."}`;
        } else if (onnxResult && onnxResult.status === "model_not_configured") {
          onnxFindingsText = `Peringatan: Model AI Vision tidak terkonfigurasi untuk domain ini. ${onnxResult.warning || ""}`;
        } else {
          onnxFindingsText = "AI Vision tidak berhasil menganalisis gambar.";
        }
      } catch (err) {
        console.error("Gagal memanggil ONNX Vision Service:", err.message);
        onnxFindingsText = "Gagal memproses gambar dengan AI Vision.";
      }
    } else {
      onnxResult = {
        status: "model_not_configured",
        warning: domainMismatchNote || "Tidak ada model AI Vision khusus yang terkonfigurasi untuk pemeriksaan ini."
      };
      onnxFindingsText = `Model AI Vision (Tidak Aktif): Pemeriksaan ini dialihkan untuk dianalisis secara visual langsung oleh MedGemma karena tidak ada model ONNX khusus yang terkonfigurasi di backend.`;
    }

    const aiUrl = req.body?.aiUrl || process.env.AI_CHATBOT_URL || "http://127.0.0.1:3000/ai/chatbot";
    const prompt = buildAnalysisPrompt(req.body?.prompt, decodedStudy, onnxFindingsText);

    const aiPayload = {
      prompt,
      message: prompt,
      text: prompt,
      contextText: decodedStudy.contextText,
      images,
      image: req.body?.includeLegacyImageFields === false ? undefined : images[0]?.data,
      imagePngBase64: req.body?.includeLegacyImageFields === false ? undefined : images[0]?.data,
      study: {
        orthancStudyId: decodedStudy.orthancStudyId,
        studyInstanceUid: decodedStudy.studyInstanceUid,
        totalInstances: decodedStudy.totalInstances,
        sampledInstances: decodedStudy.sampledInstances,
        metadata: decodedStudy.studyMetadata,
      },
      decodedStudy: stripImageData(decodedStudy),
      onnxResult, // pass along raw ONNX findings
    };

    let aiResponse = null;
    let aiError = null;
    try {
      aiResponse = await postToAi(aiUrl, aiPayload);
    } catch (aiErr) {
      console.error("AI callback failed (non-fatal):", aiErr.message);
      aiError = aiErr.message;
    }

    res.json({
      status: "OK",
      aiUrl,
      sentImages: images.length,
      ...selectedDebugFields(decodedStudy),
      decodedStudy: req.body?.returnDecodedStudy ? decodedStudy : stripImageData(decodedStudy),
      onnxResult,
      aiResponse,
      aiError,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/analyze-image", upload.single("image"), async function (req, res) {
  try {
    const file = req.file;
    const domain = req.body.domain || "xray";

    if (!file) {
      return res.status(400).json({ error: "File gambar wajib diunggah" });
    }

    const form = new FormData();
    form.append("domain", domain);
    form.append("metadata", JSON.stringify({ source: "pacs-orchestrator-raw-image" }));
    form.append("files", fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const onnxResponse = await axios.post("http://127.0.0.1:5000/analyze", form, {
      headers: form.getHeaders(),
      maxContentLength: 80 * 1024 * 1024,
      maxBodyLength: 80 * 1024 * 1024,
      timeout: 25000,
    });

    // Clean up temp file
    try {
      fs.unlinkSync(file.path);
    } catch (_) { }

    res.json(onnxResponse.data);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) { }
    }
    const detail = err.response?.data?.detail || err.response?.data || err.message;
    console.error("Gagal menganalisis gambar mentah:", detail);
    res.status(500).json({ error: typeof detail === "string" ? detail : JSON.stringify(detail) });
  }
});

module.exports = router;
