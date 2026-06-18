var axios = require("axios");

function normalizeOllamaHost(host) {
  const cleanHost = host.trim().replace(/\/+$/, "");
  if (cleanHost.endsWith("/api") || cleanHost.includes("/api/ollama")) {
    return cleanHost;
  }
  return `${cleanHost}/api`;
}

function normalizeBaseUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function getErrorMessage(err) {
  const data = err.response?.data;

  if (typeof data === "string") {
    return data;
  }

  if (data?.error) {
    return data.error;
  }

  return err.message;
}

function logBackendError(scope, err) {
  console.error(`[${scope}]`, {
    status: err.response?.status,
    message: getErrorMessage(err),
    url: err.config?.url,
    baseURL: err.config?.baseURL,
  });
}

/**
 * Konversi nilai confidence ONNX (0–1) menjadi deskripsi klinis kualitatif Bahasa Indonesia.
 * Digunakan di seluruh codebase untuk menghindari tampilan angka persen mentah.
 */
function confidenceToQualitative(confidence, label) {
  const pct = confidence * 100;
  const isNormal = (label || "").toLowerCase() === "normal";

  if (pct >= 85) {
    return isNormal
      ? "sangat kuat mengindikasikan kondisi normal"
      : `indikasi kuat mengarah ke ${label}`;
  }
  if (pct >= 70) {
    return isNormal
      ? "cenderung normal, namun perlu konfirmasi"
      : `kemungkinan besar terdapat indikasi ${label}`;
  }
  if (pct >= 50) {
    return isNormal
      ? "ada kecenderungan normal, konfirmasi diperlukan"
      : `ada indikasi ${label}, perlu evaluasi lebih lanjut`;
  }
  if (pct >= 30) {
    return isNormal
      ? "kondisi tidak sepenuhnya jelas, evaluasi klinis dianjurkan"
      : `temuan minor kemungkinan ${label}, tidak cukup spesifik`;
  }
  return isNormal
    ? "kondisi tidak dapat ditentukan dari citra ini"
    : `${label} tidak terdeteksi signifikan`;
}

/**
 * Format satu temuan ONNX menjadi kalimat klinis kualitatif.
 */
function formatOnnxFindingQualitative(finding) {
  const label = finding.label || "";
  const confidence = finding.confidence || 0;
  const desc = confidenceToQualitative(confidence, label);
  return `- ${desc.charAt(0).toUpperCase() + desc.slice(1)}.`;
}

/**
 * Hapus semua pola angka persentase dari teks (sebagai safeguard post-processing).
 * Juga membersihkan kata penghubung yang menggantung setelah angka dihapus.
 * Contoh: "SCC dengan tingkat keyakinan 61.1%." → "SCC."
 */
function stripRawPercentages(text) {
  return text
    // Hapus klausa lengkap "dengan/sebesar/yaitu/sekitar tingkat keyakinan/confidence/skor XX.X%"
    .replace(/\s*(dengan|sebesar|yaitu|sekitar|mencapai)?\s*(tingkat keyakinan|confidence|probabilitas|skor|nilai)\s*:?\s*[\d.,]+\s*%/gi, "")
    // Hapus "(XX%)" atau "(XX.X%)"
    .replace(/\([\d.,]+\s*%\s*\)/g, "")
    // Hapus ": XX%" atau "= XX%"
    .replace(/[=:]\s*[\d.,]+\s*%/g, "")
    // Hapus kata "dengan" yang kini menggantung di ujung kalimat sebelum titik/koma
    .replace(/\bdengan\s*([.,;])/gi, "$1")
    // Hapus kata "dengan" yang diikuti langsung oleh tanda baca tanpa objek
    .replace(/\bdengan\.?\s*$/gim, "")
    // Bersihkan spasi ganda dan baris kosong berlebih
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const OLLAMA_HOST = normalizeOllamaHost(
  process.env.OLLAMA_HOST || "http://10.9.23.205:11434/api"
);
const OLLAMA_MODEL = (
  process.env.OLLAMA_MODEL || "MedAIBase/MedGemma1.5:4b"
).trim();
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.2);
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || 180);
const DICOM_BRIDGE_URL = normalizeBaseUrl(process.env.DICOM_BRIDGE_URL);
const DICOM_CONTEXT_ENABLED = process.env.DICOM_CONTEXT_ENABLED !== "false";
const DICOM_FAST_SUMMARY_ENABLED =
  process.env.DICOM_FAST_SUMMARY_ENABLED !== "false";
const DICOM_CONTEXT_MAX_STUDIES = Number(
  process.env.DICOM_CONTEXT_MAX_STUDIES || 1
);
const DICOM_EXTRACTOR_URL = normalizeBaseUrl(
  process.env.DICOM_EXTRACTOR_URL ||
  (process.env.ENDPOINT
    ? `${normalizeBaseUrl(process.env.ENDPOINT)}/decode-dicom`
    : "http://10.9.23.18:4000/api/decode-dicom")
);
const DICOM_ANALYSIS_URL = normalizeBaseUrl(
  process.env.DICOM_ANALYSIS_URL ||
  `${DICOM_EXTRACTOR_URL}/study-analysis`
);
const VISMED_AI_URL = normalizeBaseUrl(
  process.env.VISMED_AI_URL || "http://10.0.1.118:3000/ai/dicom-analysis"
);
const ORTHANC_URL = normalizeBaseUrl(
  process.env.ORTHANC_URL || "http://10.9.23.18:8042"
);
const ORTHANC_USERNAME = process.env.ORTHANC_USERNAME || "orthanc";
const ORTHANC_PASSWORD = process.env.ORTHANC_PASSWORD || "orthanc";
const PACS_URL = normalizeBaseUrl(process.env.PACS_URL);
const OHIF_VIEWER_URL = normalizeBaseUrl(
  process.env.OHIF_VIEWER_URL || (PACS_URL ? `${PACS_URL}/ohif/viewer` : "")
);

const ollamaInstance = axios.create({
  baseURL: OLLAMA_HOST,
  timeout: OLLAMA_TIMEOUT_MS,
});

const dicomBridgeInstance = axios.create({
  baseURL: DICOM_BRIDGE_URL,
  timeout: 60000,
});

const dicomExtractorInstance = axios.create({
  baseURL: DICOM_EXTRACTOR_URL,
  timeout: 90000,
});

const dicomAnalysisInstance = axios.create({
  timeout: 90000,
});

const orthancInstance = axios.create({
  baseURL: ORTHANC_URL,
  timeout: 60000,
  auth: {
    username: ORTHANC_USERNAME,
    password: ORTHANC_PASSWORD,
  },
});

function shouldUseDicomContext(prompt) {
  return /dicom|orthanc|pacs|patient|pasien|nama\s*pasien|study|studi|series|modality|modalitas|ct|mri|xray|rontgen|accession|rekam\s*medis|no\.?\s*rm|nomor\s*rm|medical\s*record/i.test(
    prompt
  );
}

function toTitleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function normalizeDicomPersonName(value) {
  return String(value || "")
    .split("^")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(toTitleCase)
    .join(" ");
}

function normalizeDicomContextValue(value) {
  if (typeof value === "string") {
    return value.includes("^") ? normalizeDicomPersonName(value) : value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeDicomContextValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        normalizeDicomContextValue(item),
      ])
    );
  }

  return value;
}

function normalizeDicomContextForPrompt(dicomContext) {
  try {
    return JSON.stringify(
      normalizeDicomContextValue(JSON.parse(dicomContext)),
      null,
      2
    );
  } catch {
    return dicomContext;
  }
}

function detectAnswerLevel(prompt) {
  const text = String(prompt || "").toLowerCase();

  if (
    /simpul|kesimpulan|ringkas|rangkuman|resume|ikhtisar|impression|summary|hasil\s+pemeriksaan/i.test(
      text
    )
  ) {
    return {
      name: "Menyimpulkan data",
      instruction:
        "Buat kesimpulan lengkap dan deskriptif berdasarkan data yang tersedia. Jelaskan implikasi klinis dari temuan secara ramah pengguna. Bedakan fakta dari interpretasi. Jika data hanya metadata Orthanc, simpulkan secara administratif dan jangan membuat diagnosis klinis.",
    };
  }

  if (
    /analisis|analisa|menganalisis|menganalisa|interpretasi|evaluasi|temuan|review|nilai|bandingkan|assessment/i.test(
      text
    )
  ) {
    return {
      name: "Menganalisis data",
      instruction:
        "Analisis hubungan antar-data yang tersedia secara mendalam, misalnya identitas pasien, modalitas, tanggal studi, deskripsi studi, dan ketersediaan tautan viewer. Jelaskan relevansi dan makna klinis dari setiap temuan secara detail dan edukatif. Jangan menyimpulkan temuan radiologi atau diagnosis jika citra/laporan klinis tidak ada di konteks.",
    };
  }

  return {
    name: "Membacakan data",
    instruction:
      "Bacakan data objektif yang tersedia saja. Jangan menambah interpretasi, diagnosis, atau informasi di luar konteks.",
  };
}

function cleanDicomQueryToken(value) {
  return String(value || "")
    .trim()
    .replace(/^[("'\[]+|[).,;:!?"'\]]+$/g, "");
}

function normalizeDicomDateQuery(value) {
  const cleaned = cleanDicomQueryToken(value).replace(/-/g, "");

  return /^(19|20)\d{6}$/.test(cleaned) ? cleaned : undefined;
}

function extractDicomQuery(prompt) {
  const patientIdMatch = prompt.match(
    /(?:patient\s*id|id\s*pasien|patientid|rekam\s*medis|no\.?\s*rm|nomor\s*rm|medical\s*record(?:\s*number)?|\bid\b)\s*[:=]?\s*([A-Za-z0-9_.-]+)/i
  );
  const patientNameMatch = prompt.match(
    /(?:nama\s*pasien|patient\s*name|name)\s*[:=]?\s*([A-Za-z0-9 ._^'-]+?)(?=\s+(?:dan|dengan|rekam\s*medis|no\.?\s*rm|nomor\s*rm|patient\s*id|id\s*pasien|medical\s*record)\b|$)/i
  );
  const patientNameFallbackMatch = prompt.match(
    /(?:pasien|patient)\s+(?:dengan\s+|yang\s+)?(?:nama\s+|id\s+|no\s+|nomor\s+|bernama\s+)?([A-Za-z0-9 ._^'-]+?)(?=\s+(?:untuk|dengan|yang|dan|berdasarkan|tolong|mohon|buat|berikan|rekam\s*medis|no\.?\s*rm|nomor\s*rm|patient\s*id|id\s*pasien|medical\s*record)\b|$)/i
  );
  const studyDateMatch = prompt.match(
    /(?:tanggal\s*studi|tanggal\s*pemeriksaan|study\s*date)\s*[:=]?\s*((?:19|20)\d{2}-?\d{2}-?\d{2})/i
  );
  const orthancStudyIdMatch = prompt.match(
    /(?:orthanc\s*study\s*id|orthancstudyid|id\s*studi\s*orthanc)\s*[:=]?\s*([A-Fa-f0-9-]{20,})/i
  );
  const studyInstanceUidMatch = prompt.match(
    /(?:study\s*instance\s*uid|studyinstanceuid)\s*[:=]?\s*(1(?:\.\d+){5,})/i
  );

  return {
    patientId: cleanDicomQueryToken(patientIdMatch?.[1]),
    patientName: cleanDicomQueryToken(
      patientNameMatch?.[1] || patientNameFallbackMatch?.[1]
    ),
    studyDate: normalizeDicomDateQuery(studyDateMatch?.[1]),
    orthancStudyId: cleanDicomQueryToken(orthancStudyIdMatch?.[1]),
    studyInstanceUid: cleanDicomQueryToken(studyInstanceUidMatch?.[1]),
  };
}

function buildOrthancFindBody({
  patientId,
  patientName,
  studyDate,
  studyInstanceUid,
}) {
  const query = {};

  if (patientId) {
    query.PatientID = patientId.includes("*") ? patientId : `*${patientId}*`;
  }

  if (patientName) {
    query.PatientName = patientName.includes("*")
      ? patientName
      : `*${patientName}*`;
  }

  if (studyDate) {
    query.StudyDate = studyDate;
  }

  if (studyInstanceUid) {
    query.StudyInstanceUID = studyInstanceUid;
  }

  return {
    Level: "Study",
    Query: query,
    Expand: true,
  };
}

function buildPatientNameSearchVariants(patientName) {
  const cleanName = String(patientName || "").trim();

  if (!cleanName) {
    return [];
  }

  const tokens = cleanName
    .split(/[\s^]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const variants = [
    cleanName,
    tokens.join("*"),
    tokens.join("^"),
  ].filter(Boolean);

  return Array.from(
    new Set(
      variants.map((variant) =>
        variant.includes("*") ? variant : `*${variant}*`
      )
    )
  );
}

async function findOrthancStudies(query) {
  const patientNameVariants = buildPatientNameSearchVariants(query.patientName);
  const searches = patientNameVariants.length
    ? patientNameVariants.map((patientName) => ({
      ...query,
      patientName,
    }))
    : [query];
  const studiesById = new Map();

  for (const search of searches) {
    const response = await orthancInstance.post(
      "/tools/find",
      buildOrthancFindBody(search)
    );
    const studies = Array.isArray(response.data) ? response.data : [];

    studies.forEach((study) => {
      if (study.ID) {
        studiesById.set(study.ID, study);
      }
    });

    if (studiesById.size) {
      break;
    }
  }

  return Array.from(studiesById.values());
}

async function getOrthancStudyById(orthancStudyId) {
  if (!orthancStudyId) {
    return null;
  }

  const response = await orthancInstance.get(
    `/studies/${encodeURIComponent(orthancStudyId)}`
  );

  return response.data;
}

function removeLargeDicomPayload(value) {
  if (typeof value === "string") {
    return value.length > 500 ? `[payload dihapus, ${value.length} karakter]` : value;
  }

  if (Array.isArray(value)) {
    if (
      value.length &&
      value.every((item) => typeof item === "string" && item.length > 500)
    ) {
      return `[${value.length} payload media base64 dihapus]`;
    }

    return value.map(removeLargeDicomPayload);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/base64|png|jpeg|pixeldata|thumbnail/i.test(key))
        .map(([key, item]) => [key, removeLargeDicomPayload(item)])
    );
  }

  return value;
}

function pickFields(source, fields) {
  if (!source || typeof source !== "object") {
    return {};
  }

  return Object.fromEntries(
    fields
      .filter((field) => source[field] !== undefined && source[field] !== "")
      .map((field) => [field, source[field]])
  );
}

function summarizeExtractorContext(data) {
  const studyMetadata = pickFields(data?.studyMetadata, [
    "PatientID",
    "PatientName",
    "PatientBirthDate",
    "PatientSex",
    "StudyDate",
    "StudyTime",
    "StudyDescription",
    "Modality",
    "BodyPartExamined",
    "SeriesDescription",
    "Rows",
    "Columns",
    "PixelSpacing",
    "PhotometricInterpretation",
    "TransferSyntaxUID",
  ]);
  const instances = Array.isArray(data?.instances) ? data.instances : [];
  const mediaTypes = Array.from(
    new Set(instances.map((item) => item.mediaType).filter(Boolean))
  );

  return {
    status: data?.status,
    orthancStudyId: data?.orthancStudyId,
    studyInstanceUid: data?.studyInstanceUid,
    totalInstances: data?.totalInstances,
    sampledInstances: data?.sampledInstances,
    studyMetadata,
    mediaTypes,
    sampleInstanceMetadata: pickFields(instances[0]?.metadata, [
      "Modality",
      "SeriesDescription",
      "BodyPartExamined",
      "Rows",
      "Columns",
      "PixelSpacing",
      "PhotometricInterpretation",
    ]),
  };
}

function summarizeStudyAnalysis(data) {
  const cleanedData = removeLargeDicomPayload(data);
  const decodedStudy = cleanedData?.decodedStudy || cleanedData;
  const baseContext = summarizeExtractorContext(decodedStudy);
  const aiResponse = data?.aiResponse || cleanedData?.aiResponse || {};

  return {
    ...baseContext,
    sentImages: cleanedData?.sentImages,
    onnxResult: cleanedData?.onnxResult || data?.onnxResult,
    analysis: pickFields(cleanedData, [
      "summary",
      "impression",
      "findings",
      "clinicalFindings",
      "analysis",
      "result",
      "diagnosis",
      "recommendation",
      "limitations",
      "confidence",
      "events",
    ]),
    aiResponse: pickFields(aiResponse, [
      "response",
      "summary",
      "impression",
      "findings",
      "analysis",
      "result",
      "limitations",
    ]),
  };
}

function summarizeOrthancStudy(study) {
  return {
    orthancStudyId: study.ID,
    isStable: study.IsStable,
    lastUpdate: study.LastUpdate,
    studyTags: study.MainDicomTags,
    patientTags: study.PatientMainDicomTags,
    seriesCount: Array.isArray(study.Series) ? study.Series.length : undefined,
  };
}

function summarizeStudyCandidate(study) {
  const studyTags = study.MainDicomTags || {};
  const patientTags = study.PatientMainDicomTags || {};

  return {
    orthancStudyId: study.ID,
    patientName: patientTags.PatientName,
    patientId: patientTags.PatientID,
    patientSex: patientTags.PatientSex,
    studyDate: studyTags.StudyDate,
    studyTime: studyTags.StudyTime,
    modality: studyTags.Modality,
    studyDescription: studyTags.StudyDescription,
    studyInstanceUid: studyTags.StudyInstanceUID,
    seriesCount: Array.isArray(study.Series) ? study.Series.length : undefined,
    lastUpdate: study.LastUpdate,
  };
}

function hasSpecificStudySelector(query) {
  return Boolean(query.orthancStudyId || query.studyInstanceUid);
}

function buildStudyDisambiguationContext(query, studies) {
  return JSON.stringify(
    {
      source: "Orthanc study candidates",
      disambiguationRequired: true,
      query,
      studiesFound: studies.length,
      candidates: studies.map(summarizeStudyCandidate),
      instruction:
        "Ditemukan lebih dari satu studi untuk query ini. Jangan membuat kesimpulan pemeriksaan sebelum user memilih salah satu OrthancStudyId, StudyInstanceUID, atau tanggal/deskripsi studi yang spesifik.",
    },
    null,
    2
  );
}

async function getExtractorContext(query) {
  if (!DICOM_EXTRACTOR_URL || !ORTHANC_URL) {
    return "";
  }

  const studies = query.orthancStudyId
    ? [await getOrthancStudyById(query.orthancStudyId)]
    : await findOrthancStudies(query);

  if (!studies.length) {
    return JSON.stringify(
      {
        source: "Orthanc + decode-dicom extractor",
        query,
        studiesFound: 0,
        instruction:
          "Pasien atau studi tidak ditemukan di Orthanc. Jangan mengarang kesimpulan medis.",
      },
      null,
      2
    );
  }

  if (studies.length > 1 && !hasSpecificStudySelector(query)) {
    return buildStudyDisambiguationContext(query, studies);
  }

  const selectedStudies = studies.slice(0, Math.max(DICOM_CONTEXT_MAX_STUDIES, 1));
  const extractedStudies = await Promise.all(
    selectedStudies.map(async (study) => {
      try {
        const response = await dicomAnalysisInstance.post(
          DICOM_ANALYSIS_URL,
          {
            orthancStudyId: study.ID,
            aiUrl: VISMED_AI_URL,
            skipDicomContext: true,
          }
        );

        return {
          orthanc: summarizeOrthancStudy(study),
          extracted: summarizeStudyAnalysis(response.data),
        };
      } catch (err) {
        logBackendError("DICOM_STUDY_ANALYSIS", err);

        return {
          orthanc: summarizeOrthancStudy(study),
          analysisError:
            "Endpoint analisis DICOM belum dapat membaca studi ini. Gunakan hanya metadata Orthanc yang tersedia.",
        };
      }
    })
  );
  const ohifViewerLinks = buildOhifViewerLinks(extractedStudies);

  return JSON.stringify(
    {
      source: "Orthanc + decode-dicom study-analysis",
      query,
      studiesFound: studies.length,
      studiesReturned: extractedStudies.length,
      studies: extractedStudies,
      ohifViewerLinks,
      clinicalSafety:
        "Kesimpulan klinis hanya boleh dibuat dari hasil study-analysis/findings yang tersedia. Jika analisis gagal atau hanya metadata tersedia, jangan membuat diagnosis radiologi.",
    },
    null,
    2
  );
}

function buildOhifViewerUrl(studyInstanceUid) {
  if (!OHIF_VIEWER_URL || !studyInstanceUid) {
    return undefined;
  }

  const separator = OHIF_VIEWER_URL.includes("?") ? "&" : "?";
  return `${OHIF_VIEWER_URL}${separator}StudyInstanceUIDs=${encodeURIComponent(
    studyInstanceUid
  )}`;
}

function addStudyInstanceUidValue(value, result) {
  if (!value) {
    return;
  }

  if (typeof value === "string") {
    result.add(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => addStudyInstanceUidValue(item, result));
    return;
  }

  if (typeof value === "object") {
    addStudyInstanceUidValue(value.Value, result);
    addStudyInstanceUidValue(value.value, result);
  }
}

function collectStudyInstanceUids(value, result = new Set()) {
  if (!value || typeof value !== "object") {
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStudyInstanceUids(item, result));
    return result;
  }

  Object.entries(value).forEach(([key, item]) => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (
      normalizedKey === "studyinstanceuid" ||
      normalizedKey === "0020000d"
    ) {
      addStudyInstanceUidValue(item, result);
      return;
    }

    collectStudyInstanceUids(item, result);
  });

  return result;
}

function collectStudyInstanceUidsFromText(text) {
  const matches = String(text || "").match(/\b1(?:\.\d+){5,}\b/g);
  return matches ? new Set(matches) : new Set();
}

function buildOhifViewerLinks(studies) {
  return Array.from(collectStudyInstanceUids(studies))
    .map((studyInstanceUid) => ({
      studyInstanceUid,
      viewerUrl: buildOhifViewerUrl(studyInstanceUid),
    }))
    .filter((item) => item.viewerUrl);
}

function isViewerRequest(prompt) {
  return /gambar|image|citra|viewer|ohif|tampil|tampilkan|buka|study\s*instance|study/i.test(
    prompt
  );
}

function isTechnicalDetailRequest(prompt) {
  return /uid|study\s*instance|series\s*instance|sop\s*instance|metadata|tag\s*dicom|detail\s*teknis|identifier/i.test(
    prompt
  );
}

function extractOhifViewerLinksFromContext(dicomContext) {
  try {
    const parsed = JSON.parse(dicomContext);
    const links = Array.isArray(parsed.ohifViewerLinks)
      ? parsed.ohifViewerLinks
      : [];

    if (links.length) {
      return links;
    }

    return buildOhifViewerLinks(parsed.studies);
  } catch {
    return [];
  }
}

function getViewerLinks(prompt, responseText, dicomContext) {
  const linksByUid = new Map();

  extractOhifViewerLinksFromContext(dicomContext).forEach((link) => {
    if (link.studyInstanceUid && link.viewerUrl) {
      linksByUid.set(link.studyInstanceUid, link);
    }
  });

  collectStudyInstanceUidsFromText(`${prompt}\n${responseText}`).forEach(
    (studyInstanceUid) => {
      const viewerUrl = buildOhifViewerUrl(studyInstanceUid);

      if (viewerUrl) {
        linksByUid.set(studyInstanceUid, { studyInstanceUid, viewerUrl });
      }
    }
  );

  return Array.from(linksByUid.values());
}

function appendViewerLinksIfNeeded(prompt, responseText, dicomContext) {
  if (!dicomContext || !isViewerRequest(prompt)) {
    return responseText;
  }

  const cleanedResponseText = responseText.replace(
    /https?:\/\/\s*viewerUrl[^\n]*/gi,
    "URL OHIF Viewer akan ditampilkan di bawah."
  );
  const links = getViewerLinks(prompt, cleanedResponseText, dicomContext);

  if (!links.length) {
    return cleanedResponseText;
  }

  const missingLinks = links.filter(
    ({ viewerUrl }) => viewerUrl && !cleanedResponseText.includes(viewerUrl)
  );

  if (!missingLinks.length) {
    return responseText;
  }

  return [
    cleanedResponseText.trim(),
    "",
    "Link OHIF Viewer:",
    ...missingLinks.map(({ viewerUrl }) => `- ${viewerUrl}`),
  ].join("\n");
}

function normalizeUrlForComparison(url) {
  return String(url || "").replace(/[).,;!?]+$/g, "");
}

function removeUnauthorizedUrls(responseText, allowedUrls) {
  const allowed = new Set(allowedUrls.map(normalizeUrlForComparison));

  return String(responseText || "")
    .split("\n")
    .filter((line) => {
      const urls = line.match(/https?:\/\/[^\s)]+/gi) || [];
      return urls.every((url) => allowed.has(normalizeUrlForComparison(url)));
    })
    .join("\n");
}

function removeTechnicalUidLines(responseText, prompt) {
  if (isTechnicalDetailRequest(prompt)) {
    return responseText;
  }

  return String(responseText || "")
    .split("\n")
    .filter(
      (line) =>
        !/\b(?:study|series|sop)?\s*instance\s*uid\b|\buid\b/i.test(line)
    )
    .join("\n");
}

function removeUnavailableTechnicalLines(responseText, prompt) {
  if (isTechnicalDetailRequest(prompt)) {
    return responseText;
  }

  return String(responseText || "")
    .split("\n")
    .filter(
      (line) =>
        !/(?:study\s*id|studyid|id\s*studi)\s*:?(\s*|-|tidak\s*tersedia|\(tidak\s*tersedia\))?$/i.test(
          line.trim()
        )
    )
    .join("\n");
}

function polishIndonesianMedicalTerms(responseText) {
  // Extract URLs to avoid translating them (e.g. StudyInstanceUIDs -> UID Studis)
  const urls = [];
  let text = String(responseText || "").replace(/(https?:\/\/[^\s)]+)/gi, (match) => {
    urls.push(match);
    return `___URL_PLACEHOLDER_${urls.length - 1}___`;
  });

  text = text
    .replace(/```+/g, "")
    .replace(/^Tentu,\s*/i, "")
    .replace(/^\s*[*-]\s+/gm, "");

  // 1. Specific phrases (case-insensitive) to prevent partial/weird translations like "Studi Date"
  const phrases = [
    { regex: /study\s*date/gi, replacement: "Tanggal studi" },
    { regex: /study\s*time/gi, replacement: "Waktu studi" },
    { regex: /study\s*description/gi, replacement: "Deskripsi studi" },
    { regex: /study\s*instance\s*uid/gi, replacement: "UID Studi" },
    { regex: /study\s*id/gi, replacement: "ID studi" },
    { regex: /series\s*description/gi, replacement: "Deskripsi seri" },
    { regex: /series\s*instance\s*uid/gi, replacement: "UID Seri" },
    { regex: /patient\s*name/gi, replacement: "Nama pasien" },
    { regex: /patient\s*id/gi, replacement: "ID pasien" },
    { regex: /patient\s*sex/gi, replacement: "Jenis kelamin" },
    { regex: /patient\s*birth\s*date/gi, replacement: "Tanggal lahir pasien" },
    { regex: /patient\s*birthdate/gi, replacement: "Tanggal lahir pasien" },
    { regex: /body\s*part\s*examined/gi, replacement: "Bagian tubuh" },
    { regex: /body\s*part/gi, replacement: "Bagian tubuh" },
    { regex: /pixel\s*spacing/gi, replacement: "Jarak piksel" },
    { regex: /photometric\s*interpretation/gi, replacement: "Interpretasi fotometrik" },
    { regex: /transfer\s*syntax\s*uid/gi, replacement: "UID Transfer Syntax" },
    { regex: /sop\s*instance\s*uid/gi, replacement: "UID SOP Instance" },
    { regex: /number\s*of\s*frames/gi, replacement: "Jumlah frame" },
    { regex: /total\s*instances/gi, replacement: "Jumlah instance" },
    { regex: /sent\s*images/gi, replacement: "Jumlah gambar dikirim" },
    { regex: /media\s*type/gi, replacement: "Tipe media" },
    { regex: /sample\s*instance\s*metadata/gi, replacement: "Metadata sampel instance" },
    { regex: /image\s*size/gi, replacement: "Ukuran citra" },
    { regex: /Nama Pasien/g, replacement: "Nama pasien" },
    { regex: /ID Pasien/g, replacement: "ID pasien" },
    { regex: /Nomor Rekam Medis/g, replacement: "Nomor rekam medis" },
    { regex: /Tanggal Studi/g, replacement: "Tanggal studi" },
    { regex: /Deskripsi Studi/g, replacement: "Deskripsi studi" },
    { regex: /Jumlah seri terkait Studi/g, replacement: "Jumlah seri terkait" },
    { regex: /Jumlah instance terkait Studi/g, replacement: "Jumlah instance terkait" },
    { regex: /Jumlah Seri Terkait/g, replacement: "Jumlah seri terkait" },
    { regex: /Jumlah Instance Terkait/g, replacement: "Jumlah instance terkait" }
  ];

  phrases.forEach(({ regex, replacement }) => {
    text = text.replace(regex, replacement);
  });

  // 2. Single words (case-insensitive)
  text = text
    .replace(/\bModality\b/gi, "Modalitas")
    .replace(/\bRows\b/gi, "Baris")
    .replace(/\bColumns\b/gi, "Kolom")
    .replace(/\bPatient\b/gi, "Pasien")
    .replace(/\bStudy\b/gi, "Studi")
    .replace(/\bSeries\b/gi, "Seri")
    .replace(/\bInstance\b/gi, "Instance");

  // 3. DICOM date formatting supporting both 19xx and 20xx
  text = text.replace(
    /\b((?:19|20)\d{2})(\d{2})(\d{2})\b/g,
    (_, year, month, day) => `${year}-${month}-${day}`
  );

  // Restore URLs
  urls.forEach((url, idx) => {
    text = text.replace(`___URL_PLACEHOLDER_${idx}___`, url);
  });

  return text;
}

function removeEmptyLabelLines(responseText) {
  return String(responseText || "")
    .split("\n")
    .filter((line) => !/^\s*(?:\*\*)?(?:id\s*studi|studi\s*id)(?:\*\*)?\s*:\s*$/i.test(line))
    .join("\n");
}

function removeRawJsonSections(responseText) {
  const lines = String(responseText || "").split("\n");
  const cleanedLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index].trim();
    const nextLine = lines[index + 1]?.trim();
    const secondNextLine = lines[index + 2]?.trim();
    let jsonStartIndex = -1;

    if (/^deskripsi\s*:$/i.test(currentLine) && /^json$/i.test(nextLine) && secondNextLine === "{") {
      jsonStartIndex = index + 2;
    } else if (/^deskripsi\s*:$/i.test(currentLine) && nextLine === "{") {
      jsonStartIndex = index + 1;
    } else if (/^json$/i.test(currentLine) && nextLine === "{") {
      jsonStartIndex = index + 1;
    } else if (currentLine === "{") {
      jsonStartIndex = index;
    }

    if (jsonStartIndex === -1) {
      cleanedLines.push(lines[index]);
      continue;
    }

    let braceDepth = 0;
    index = jsonStartIndex;

    for (; index < lines.length; index += 1) {
      const line = lines[index];
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;

      if (braceDepth <= 0 && line.includes("}")) {
        break;
      }
    }
  }

  return cleanedLines.join("\n");
}

function removeStandaloneJsonMarkers(responseText) {
  return String(responseText || "")
    .split("\n")
    .filter((line) => !/^\s*json\s*$/i.test(line))
    .join("\n");
}

function removeEmptySectionHeadings(responseText) {
  const lines = String(responseText || "").split("\n");
  const sectionRegex = /^\s*(?:\*\*)?(?:analisis|kesimpulan|batasan|temuan|catatan)(?:\*\*)?\s*:\s*$/i;
  const sectionStartRegex = /^\s*(?:\*\*)?(?:analisis|kesimpulan|batasan|temuan|catatan)(?:\*\*)?\s*:/i;

  return lines
    .filter((line, index) => {
      if (!sectionRegex.test(line)) {
        return true;
      }

      const nextMeaningfulLine = lines
        .slice(index + 1)
        .find((item) => item.trim());

      return Boolean(nextMeaningfulLine) && !sectionStartRegex.test(nextMeaningfulLine);
    })
    .join("\n");
}

function normalizeLabelName(line) {
  const match = String(line || "").match(/^\s*(?:\*\*)?([^:*]+?)(?:\*\*)?\s*:/);
  return match?.[1]?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function removeRepeatedLabelLines(responseText) {
  const seenLabels = new Set();

  return String(responseText || "")
    .split("\n")
    .filter((line) => {
      const label = normalizeLabelName(line);

      if (!label) {
        return true;
      }

      if (seenLabels.has(label)) {
        return false;
      }

      seenLabels.add(label);
      return true;
    })
    .join("\n");
}

function capitalizeFirstLetter(responseText) {
  return String(responseText || "").replace(/^(\s*)([a-z])/, (_, space, letter) =>
    `${space}${letter.toUpperCase()}`
  );
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map((item) =>
        typeof item === "object" ? JSON.stringify(item) : String(item)
      )
      .join(" x ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return value === undefined || value === null || value === "" ? "-" : value;
}

function formatDicomDate(value) {
  const text = String(value || "");
  const match = text.match(/^(20\d{2}|19\d{2})(\d{2})(\d{2})$/);

  if (!match) {
    return formatValue(value);
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function buildStudyDisambiguationResponse(dicomContext) {
  let parsed;

  try {
    parsed = JSON.parse(dicomContext);
  } catch {
    return null;
  }

  if (parsed.source !== "Orthanc study candidates") {
    return null;
  }

  const candidates = Array.isArray(parsed.candidates)
    ? parsed.candidates
    : [];

  if (!candidates.length) {
    return null;
  }

  const lines = [
    "Saya menemukan lebih dari satu studi untuk pasien tersebut.",
    "Silakan pilih salah satu pemeriksaan berikut untuk dianalisis:",
    "",
  ];

  candidates.forEach((study, index) => {
    lines.push(`Pemeriksaan ${index + 1}:`);
    lines.push(
      `Nama pasien: ${formatValue(normalizeDicomPersonName(study.patientName))}`
    );
    lines.push(`ID pasien: ${formatValue(study.patientId)}`);
    lines.push(`Tanggal studi: ${formatDicomDate(study.studyDate)}`);
    lines.push(`Modalitas: ${formatValue(study.modality)}`);
    lines.push(`Deskripsi studi: ${formatValue(study.studyDescription)}`);
    lines.push(`Jumlah seri: ${formatValue(study.seriesCount)}`);
    lines.push(`[STUDY_CANDIDATE:${study.orthancStudyId}]`);
    lines.push("");
  });

  return lines.join("\n").trim();
}

function buildImageAvailabilityLine(prompt, viewerLinks) {
  if (!isViewerRequest(prompt)) {
    return "";
  }

  if (!viewerLinks.length) {
    return "Viewer: Link OHIF tidak tersedia untuk studi ini.";
  }

  return `Viewer: ${viewerLinks[0].viewerUrl}`;
}

function buildFastDicomResponse(prompt, dicomContext, answerLevel) {
  if (!DICOM_FAST_SUMMARY_ENABLED || !dicomContext) {
    return null;
  }

  let parsed;

  try {
    parsed = JSON.parse(dicomContext);
  } catch {
    return null;
  }

  if (
    parsed.source !== "Orthanc + decode-dicom extractor" &&
    parsed.source !== "Orthanc + decode-dicom study-analysis"
  ) {
    return null;
  }

  if (!/hasil\s+pemeriksaan|simpul|kesimpulan|ringkas|rangkuman|resume|ikhtisar|tampil|tampilkan|gambar|viewer|citra/i.test(prompt)) {
    return null;
  }

  if (!parsed.studiesFound) {
    return [
      "Data pemeriksaan belum ditemukan di Orthanc untuk pasien tersebut.",
      "Kesimpulan: belum ada data studi yang bisa disimpulkan.",
      "Batasan: AI tidak boleh membuat hasil pemeriksaan tanpa data DICOM atau laporan klinis.",
    ].join("\n");
  }

  const study = parsed.studies?.[0];
  const metadata = study?.extracted?.studyMetadata || {};
  const orthancPatient = study?.orthanc?.patientTags || {};
  const orthancStudy = study?.orthanc?.studyTags || {};
  const viewerLinks = getViewerLinks(prompt, "", dicomContext);
  const viewerLine = buildImageAvailabilityLine(prompt, viewerLinks);
  const patientName = normalizeDicomPersonName(
    metadata.PatientName || orthancPatient.PatientName || parsed.query?.patientName
  );
  const modality = metadata.Modality || orthancStudy.Modality;
  const rows = metadata.Rows;
  const columns = metadata.Columns;
  const imageSize = rows && columns ? `${rows} x ${columns}` : "-";
  const mediaTypes = study?.extracted?.mediaTypes?.length
    ? study.extracted.mediaTypes.join(", ")
    : "-";
  const analysis = study?.extracted?.analysis || {};
  const aiResponse = study?.extracted?.aiResponse || {};
  // Full AI narrative from callback takes highest priority
  const analysisSummary =
    aiResponse.response ||
    analysis.summary ||
    analysis.impression ||
    analysis.findings ||
    analysis.clinicalFindings ||
    analysis.result ||
    analysis.analysis ||
    aiResponse.summary ||
    aiResponse.impression ||
    aiResponse.findings ||
    aiResponse.analysis ||
    aiResponse.result;
  const lines = [
    "Berikut ringkasan pemeriksaan berdasarkan data DICOM yang tersedia.",
    `Nama pasien: ${formatValue(patientName)}`,
    `ID pasien: ${formatValue(metadata.PatientID || orthancPatient.PatientID)}`,
    `Jenis kelamin: ${formatValue(metadata.PatientSex || orthancPatient.PatientSex)}`,
    `Tanggal studi: ${formatDicomDate(metadata.StudyDate || orthancStudy.StudyDate)}`,
    `Modalitas: ${formatValue(modality)}`,
    `Deskripsi studi: ${formatValue(metadata.StudyDescription || orthancStudy.StudyDescription)}`,
    `Deskripsi seri: ${formatValue(metadata.SeriesDescription)}`,
    `Bagian tubuh: ${formatValue(metadata.BodyPartExamined)}`,
    `Jumlah instance: ${formatValue(study?.extracted?.totalInstances)}`,
    `Jumlah gambar/frame dikirim ke AI: ${formatValue(study?.extracted?.sentImages)}`,
    `Ukuran citra: ${imageSize}`,
  ];

  if (viewerLine) {
    lines.push(viewerLine);
  }

  // Always show AI narrative if available (from callback aiResponse)
  if (analysisSummary) {
    lines.push("");
    lines.push(analysisSummary);
    lines.push("");
    lines.push("Batasan: hasil analisis AI perlu dikonfirmasi oleh dokter/radiolog.");
  } else if (answerLevel?.name === "Menyimpulkan data") {
    lines.push(
      `\nKesimpulan: data menunjukkan pemeriksaan ${formatValue(
        modality
      )} dengan deskripsi ${formatValue(
        metadata.StudyDescription || orthancStudy.StudyDescription
      )}. Tidak ada temuan klinis atau diagnosis yang dapat dipastikan dari metadata saja.`
    );
    lines.push(
      "Batasan: ringkasan ini dibuat dari metadata dan konteks ekstraksi DICOM, bukan interpretasi radiolog atas citra."
    );
  }

  return lines.join("\n");
}

function getNonLatinLetterRatio(responseText) {
  const letters = Array.from(String(responseText || "").matchAll(/\p{L}/gu), (match) => match[0]);

  if (letters.length < 20) {
    return 0;
  }

  const latinLetters = letters.filter((letter) =>
    /\p{Script=Latin}/u.test(letter)
  ).length;

  return (letters.length - latinLetters) / letters.length;
}

function hasInvalidResponseLanguage(responseText) {
  const text = String(responseText || "");
  const lowerText = text.toLowerCase();
  const letterText = Array.from(text.matchAll(/\p{L}/gu), (match) => match[0])
    .join("")
    .toLowerCase();

  if (!letterText || letterText.length < 12 || /^json+$/.test(letterText)) {
    return true;
  }

  if (
    /<unused\d+>|<\/?thought\b|thinking process|understand the goal|extract the viewer url|desired analysis|provided json data|propelling_analysis|for_user_query|_analysis_of_/i.test(
      text
    )
  ) {
    return true;
  }

  if (
    /[\p{Script=Arabic}\p{Script=Greek}\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Cyrillic}\p{Script=Kannada}\p{Script=Devanagari}\p{Script=Telugu}\p{Script=Tamil}\p{Script=Thai}\p{Script=Bengali}\p{Script=Malayalam}\p{Script=Gujarati}\p{Script=Gurmukhi}\p{Script=Oriya}]/u.test(
      text
    )
  ) {
    return true;
  }

  if (getNonLatinLetterRatio(text) > 0.15) {
    return true;
  }

  // Count common English stop words that are not used in Indonesian
  const englishStopWords = [
    /\bthe\b/i,
    /\bof\b/i,
    /\band\b/i,
    /\bis\b/i,
    /\bfor\b/i,
    /\bthis\b/i,
    /\bwith\b/i,
    /\bin\b/i,
    /\bto\b/i,
    /\bby\b/i,
    /\bon\b/i,
    /\bat\b/i,
    /\bfrom\b/i,
    /\babout\b/i,
    /\bclinical\b/i,
    /\btrials?\b/i,
    /\bdiscusses\b/i,
    /\bcovers\b/i,
    /\bincludes\b/i,
  ];

  const englishMarkersCount = englishStopWords.filter((regex) => regex.test(text)).length;

  const englishMarkers = [
    "here's",
    "the user wants",
    "based on the provided",
    "should include",
    "array contains",
    "thinking process",
    "the goal",
    "extract",
    "desired analysis",
    "provided json",
  ].filter((marker) => lowerText.includes(marker)).length + englishMarkersCount;

  const indonesianMarkers = [
    "pasien",
    "pemeriksaan",
    "studi",
    "tanggal",
    "modalitas",
    "deskripsi",
    "batasan",
    "ringkasan",
    "dokter",
    "radiolog",
    "berdasarkan",
    "adalah",
    "untuk",
    "dengan",
    "pada",
    "dari",
    "yang",
    "tidak",
    "ditemukan",
    "tersedia",
  ].filter((marker) => lowerText.includes(marker)).length;

  if (text.length > 40 && indonesianMarkers === 0) {
    return true;
  }

  return englishMarkers >= 12 && englishMarkers > indonesianMarkers * 2.0;
}

function buildDicomMetadataFallbackResponse(prompt, dicomContext, reason) {
  if (!dicomContext) {
    return null;
  }

  let parsed;

  try {
    parsed = JSON.parse(dicomContext);
  } catch {
    return null;
  }

  if (
    parsed.source !== "Orthanc + decode-dicom extractor" &&
    parsed.source !== "Orthanc + decode-dicom study-analysis"
  ) {
    return null;
  }

  if (!parsed.studiesFound) {
    return [
      "Data pemeriksaan belum ditemukan di Orthanc untuk pasien tersebut.",
      "Kesimpulan: belum ada data studi yang bisa disimpulkan.",
      "Batasan: AI tidak boleh membuat hasil pemeriksaan tanpa data DICOM atau laporan klinis.",
    ].join("\n");
  }

  const study = parsed.studies?.[0];
  const metadata = study?.extracted?.studyMetadata || {};
  const orthancPatient = study?.orthanc?.patientTags || {};
  const orthancStudy = study?.orthanc?.studyTags || {};
  const viewerLinks = getViewerLinks(prompt, "", dicomContext);
  const viewerLine = buildImageAvailabilityLine(prompt, viewerLinks);
  const patientName = normalizeDicomPersonName(
    metadata.PatientName || orthancPatient.PatientName || parsed.query?.patientName
  );
  const modality = metadata.Modality || orthancStudy.Modality;
  const rows = metadata.Rows;
  const columns = metadata.Columns;
  const imageSize = rows && columns ? `${rows} x ${columns}` : "-";
  const mediaTypes = study?.extracted?.mediaTypes?.length
    ? study.extracted.mediaTypes.join(", ")
    : "-";
  const lines = [
    "Berikut ringkasan pemeriksaan berdasarkan metadata DICOM yang tersedia.",
    `Nama pasien: ${formatValue(patientName)}`,
    `ID pasien: ${formatValue(metadata.PatientID || orthancPatient.PatientID)}`,
    `Jenis kelamin: ${formatValue(metadata.PatientSex || orthancPatient.PatientSex)}`,
    `Tanggal studi: ${formatDicomDate(metadata.StudyDate || orthancStudy.StudyDate)}`,
    `Modalitas: ${formatValue(modality)}`,
    `Deskripsi studi: ${formatValue(metadata.StudyDescription || orthancStudy.StudyDescription)}`,
    `Deskripsi seri: ${formatValue(metadata.SeriesDescription)}`,
    `Bagian tubuh: ${formatValue(metadata.BodyPartExamined)}`,
    `Jumlah instance: ${formatValue(study?.extracted?.totalInstances)}`,
    `Media: ${formatValue(mediaTypes)}`,
    `Jumlah gambar/frame dikirim ke AI: ${formatValue(study?.extracted?.sentImages)}`,
    `Ukuran citra: ${imageSize}`,
  ];

  if (viewerLine) {
    lines.push(viewerLine);
  }

  const onnxResult = study?.extracted?.onnxResult || parsed.onnxResult;
  if (onnxResult && onnxResult.status === "ok" && onnxResult.analyzedFiles) {
    lines.push("");
    lines.push("**Hasil Temuan AI Vision:**");
    onnxResult.analyzedFiles.forEach((file) => {
      if (file.findings && file.findings.length > 0) {
        // Pilih temuan paling signifikan (confidence tertinggi)
        const sorted = [...file.findings].sort((a, b) => b.confidence - a.confidence);
        const dominant = sorted[0];
        const secondary = sorted.slice(1).filter(f => f.confidence >= 0.25);

        lines.push(formatOnnxFindingQualitative(dominant));
        secondary.forEach(f => lines.push(formatOnnxFindingQualitative(f)));
      }
    });
  }

  lines.push("");
  lines.push(
    `Batasan: ${reason}. Ringkasan ini dibuat dari metadata/konteks decode DICOM, bukan interpretasi visual citra. Validasi dokter/radiolog tetap diperlukan.`
  );

  return lines.join("\n");
}

function buildStructuredHybridBlock(dicomContext) {
  if (!dicomContext) {
    return "";
  }

  let parsed;
  try {
    parsed = JSON.parse(dicomContext);
  } catch {
    return "";
  }

  if (
    parsed.disambiguationRequired ||
    parsed.studiesFound === 0 ||
    parsed.source === "Orthanc study candidates"
  ) {
    return "";
  }

  const study = parsed.studies?.[0];
  if (!study) {
    return "";
  }

  const metadata = study.extracted?.studyMetadata || {};
  const orthancPatient = study.orthanc?.patientTags || {};
  const orthancStudy = study.orthanc?.studyTags || {};
  
  const patientName = normalizeDicomPersonName(
    metadata.PatientName || orthancPatient.PatientName || parsed.query?.patientName
  );
  const modality = metadata.Modality || orthancStudy.Modality || "-";
  const studyDate = metadata.StudyDate || orthancStudy.StudyDate || "-";
  const studyDesc = metadata.StudyDescription || orthancStudy.StudyDescription || "-";
  const patientId = metadata.PatientID || orthancPatient.PatientID || parsed.query?.patientId || "-";

  const lines = [
    `**Nama pasien:** ${formatValue(patientName)}`,
    `**Modalitas:** ${formatValue(modality)}`,
    `**Tanggal studi:** ${formatDicomDate(studyDate)}`,
    `**Deskripsi studi:** ${formatValue(studyDesc)}`,
    `**Nomor rekam medis:** ${formatValue(patientId)}`,
    "",
    "**Hasil Temuan AI Vision (ONNX):**"
  ];

  const onnxResult = study.extracted?.onnxResult || parsed.onnxResult;
  let hasFindings = false;

  if (onnxResult && onnxResult.status === "ok" && onnxResult.analyzedFiles) {
    onnxResult.analyzedFiles.forEach((file) => {
      if (file.findings && file.findings.length > 0) {
        hasFindings = true;
        const sorted = [...file.findings].sort((a, b) => b.confidence - a.confidence);
        const dominant = sorted[0];
        lines.push(formatOnnxFindingQualitative(dominant));
        
        const secondary = sorted.slice(1).filter(f => f.confidence >= 0.25);
        secondary.forEach(f => lines.push(formatOnnxFindingQualitative(f)));
      }
    });
  }

  if (!hasFindings) {
    lines.push("- Tidak ditemukan kelainan signifikan oleh model klasifikasi otomatis.");
  }

  return lines.join("\n");
}

function buildStructuredBlockFromCallbackBody(body) {
  if (!body) {
    return "";
  }

  const decodedStudy = body.decodedStudy || {};
  const study = body.study || {};
  const metadata = study.metadata || decodedStudy.studyMetadata || {};

  const patientName = normalizeDicomPersonName(metadata.PatientName);
  const modality = metadata.Modality || "-";
  const studyDate = metadata.StudyDate || "-";
  const studyDesc = metadata.StudyDescription || "-";
  const patientId = metadata.PatientID || "-";

  const lines = [
    `**Nama pasien:** ${formatValue(patientName)}`,
    `**Modalitas:** ${formatValue(modality)}`,
    `**Tanggal studi:** ${formatDicomDate(studyDate)}`,
    `**Deskripsi studi:** ${formatValue(studyDesc)}`,
    `**Nomor rekam medis:** ${formatValue(patientId)}`,
    "",
    "**Hasil Temuan AI Vision (ONNX):**"
  ];

  const onnxResult = body.onnxResult || decodedStudy.onnxResult || study.onnxResult;
  let hasFindings = false;

  if (onnxResult && onnxResult.status === "ok" && onnxResult.analyzedFiles) {
    onnxResult.analyzedFiles.forEach((file) => {
      if (file.findings && file.findings.length > 0) {
        hasFindings = true;
        const sorted = [...file.findings].sort((a, b) => b.confidence - a.confidence);
        const dominant = sorted[0];
        lines.push(formatOnnxFindingQualitative(dominant));
        
        const secondary = sorted.slice(1).filter(f => f.confidence >= 0.25);
        secondary.forEach(f => lines.push(formatOnnxFindingQualitative(f)));
      }
    });
  }

  if (!hasFindings) {
    lines.push("- Tidak ditemukan kelainan signifikan oleh model klasifikasi otomatis.");
  }

  return lines.join("\n");
}

function buildDicomAnalysisCallbackFallback(body, reason) {
  const decodedStudy = body?.decodedStudy || {};
  const study = body?.study || {};
  const metadata = study.metadata || decodedStudy.studyMetadata || {};
  const mediaCount = [
    ...(Array.isArray(body?.images) ? body.images : []),
    ...(Array.isArray(body?.frames) ? body.frames : []),
  ].length;

  const lines = [
    "Berikut ringkasan pemeriksaan berdasarkan metadata DICOM yang dikirim oleh service VM.",
    `ID pasien: ${formatValue(metadata.PatientID)}`,
    `Nama pasien: ${formatValue(normalizeDicomPersonName(metadata.PatientName))}`,
    `Tanggal studi: ${formatDicomDate(metadata.StudyDate)}`,
    `Modalitas: ${formatValue(metadata.Modality)}`,
    `Deskripsi studi: ${formatValue(metadata.StudyDescription)}`,
    `Deskripsi seri: ${formatValue(metadata.SeriesDescription)}`,
    `Bagian tubuh: ${formatValue(metadata.BodyPartExamined)}`,
    `Jumlah instance: ${formatValue(study.totalInstances || decodedStudy.totalInstances)}`,
    `Jumlah sample instance: ${formatValue(study.sampledInstances || decodedStudy.sampledInstances)}`,
    `Jumlah media/frame dikirim: ${formatValue(mediaCount)}`,
  ];

  const onnxResult = body?.onnxResult || decodedStudy?.onnxResult || study?.onnxResult;
  if (onnxResult && onnxResult.status === "ok" && onnxResult.analyzedFiles) {
    lines.push("");
    lines.push("**Hasil Temuan AI Vision:**");
    onnxResult.analyzedFiles.forEach((file) => {
      if (file.findings && file.findings.length > 0) {
        const sorted = [...file.findings].sort((a, b) => b.confidence - a.confidence);
        const dominant = sorted[0];
        const secondary = sorted.slice(1).filter(f => f.confidence >= 0.25);
        lines.push(formatOnnxFindingQualitative(dominant));
        secondary.forEach(f => lines.push(formatOnnxFindingQualitative(f)));
      }
    });
  }

  lines.push("");
  lines.push(`Batasan: ${reason}. Endpoint ini belum meneruskan pixel gambar/frame sebagai input vision ke model, sehingga tidak ada interpretasi visual atau diagnosis final.`);

  return lines.join("\n");
}

function postProcessAiResponse(responseText, prompt, viewerLinks) {
  const allowedViewerUrls = viewerLinks.map((link) => link.viewerUrl);

  const cleaned = capitalizeFirstLetter(
    removeRepeatedLabelLines(
      removeEmptySectionHeadings(
        removeEmptyLabelLines(
          polishIndonesianMedicalTerms(
            removeStandaloneJsonMarkers(
              removeRawJsonSections(
                removeUnavailableTechnicalLines(
                  removeTechnicalUidLines(
                    removeUnauthorizedUrls(responseText, allowedViewerUrls),
                    prompt
                  ),
                  prompt
                ),
              )
            )
          )
        )
      )
    )
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Safeguard: hapus persentase confidence mentah yang lolos dari instruksi LLM
  return stripRawPercentages(cleaned);
}

async function getDicomContext(prompt) {
  if (!DICOM_CONTEXT_ENABLED || !shouldUseDicomContext(prompt)) {
    return "";
  }

  const query = extractDicomQuery(prompt);
  const { patientId, patientName } = query;

  if (!patientId && !patientName && !query.orthancStudyId && !query.studyInstanceUid) {
    return [
      "User menanyakan data DICOM/PACS, tetapi belum memberikan patient ID atau nama pasien yang spesifik.",
      "Minta user menyertakan patient ID atau nama pasien agar data Orthanc bisa dicari.",
    ].join("\n");
  }

  try {
    const extractorContext = await getExtractorContext(query);

    if (extractorContext) {
      return extractorContext;
    }
  } catch (err) {
    logBackendError("DICOM_EXTRACTOR", err);
  }

  if (!DICOM_BRIDGE_URL) {
    return [
      "Data DICOM/PACS diminta, tetapi extractor DICOM atau Orthanc belum dapat diakses saat ini.",
      "Jangan mengarang data pasien. Sampaikan bahwa data PACS belum tersedia dan minta user mencoba kembali setelah koneksi diperiksa.",
    ].join("\n");
  }

  try {
    if (patientId) {
      const [patients, studies] = await Promise.all([
        dicomBridgeInstance.get("/patients", {
          params: {
            patientId,
            attributePreset: "standard",
          },
        }),
        dicomBridgeInstance.get("/studies", {
          params: {
            patientId,
          },
        }),
      ]);
      const ohifViewerLinks = buildOhifViewerLinks(studies.data);

      return JSON.stringify(
        {
          source: "Orthanc via dicom-mcp",
          query: { patientId },
          patients: patients.data,
          studies: studies.data,
          ohifViewerLinks,
        },
        null,
        2
      );
    }

    const namePattern = patientName.includes("*") ? patientName : `${patientName}*`;
    const patients = await dicomBridgeInstance.get("/patients", {
      params: {
        name: namePattern,
        attributePreset: "standard",
      },
    });

    return JSON.stringify(
      {
        source: "Orthanc via dicom-mcp",
        query: { patientName, namePattern },
        patients: patients.data,
      },
      null,
      2
    );
  } catch (err) {
    logBackendError("DICOM_MCP_BRIDGE", err);

    return [
      "Data DICOM/PACS diminta, tetapi data belum dapat diakses saat ini.",
      "Jangan mengarang data pasien. Sampaikan bahwa data PACS belum tersedia dan minta user mencoba kembali setelah koneksi diperiksa.",
    ].join("\n");
  }
}

function buildPromptWithDicomContext(
  prompt,
  dicomContext,
  answerLevel = detectAnswerLevel(prompt)
) {
  if (!dicomContext) {
    return [
      "Kamu adalah asisten medis untuk sistem PACS VisMed.",
      "Jawab dalam bahasa Indonesia yang baik, jelas, dan sesuai EYD/PUEBI.",
      "Jangan mengarang data pasien, hasil pemeriksaan, diagnosis, atau rekomendasi klinis.",
      "Jika user meminta data PACS/Orthanc tetapi konteks tidak tersedia, minta patient ID atau nama pasien yang spesifik.",
      "Jika pertanyaan bersifat medis, jelaskan bahwa jawaban AI bersifat pendukung dan bukan pengganti dokter/radiolog.",
      "",
      "PERTANYAAN USER:",
      prompt,
    ].join("\n");
  }

  const normalizedDicomContext = normalizeDicomContextForPrompt(dicomContext);

  return [
    "Kamu adalah asisten medis untuk sistem PACS VisMed.",
    "Gunakan hanya DATA DICOM/ORTHANC berikut sebagai sumber jawaban.",
    "Jawab dalam bahasa Indonesia yang baik, jelas, informatif, dan sesuai EYD/PUEBI. Berikan penjelasan medis/klinis yang deskriptif dan edukatif, hindari jawaban yang terlalu pendek.",
    `Tingkat jawaban: ${answerLevel.name}.`,
    answerLevel.instruction,
    "",
    "ATURAN WAJIB:",
    "1. JANGAN menulis ulang tabel metadata pasien (Nama pasien, Modalitas, Tanggal studi, Deskripsi studi, Nomor rekam medis) di awal jawaban Anda. Bagian ini sudah dibuat secara otomatis oleh sistem. Langsung saja berikan analisis Anda.",
    "2. Jangan mengarang data pasien, study, series, temuan klinis, diagnosis, atau tindakan medis yang tidak ada di konteks.",
    "3. Jika suatu informasi tidak ada di konteks, tulis bahwa data tersebut tidak tersedia.",
    "4. Ubah format nama DICOM yang memakai tanda ^ menjadi nama manusiawi, misalnya byan^sujatmiko^kuncoro menjadi Byan Sujatmiko Kuncoro.",
    "5. Jangan tampilkan JSON mentah, struktur object, array, key-value teknis, atau raw response kepada user.",
    "6. Jika perlu menyebut data, ubah menjadi kalimat atau daftar poin sederhana.",
    "7. Gunakan istilah baku: pasien, studi, modalitas, tanggal studi, deskripsi studi, dan nomor rekam medis.",
    "8. Jika gambar/frame medis dilampirkan secara visual (sebagai input vision), gunakan kemampuan vision Anda untuk menganalisisnya secara visual bersama dengan data teks yang tersedia. Jika tidak ada gambar medis terlampir dan konteks hanya berisi metadata, nyatakan batasannya dengan sopan.",
    "8a. Jika konteks berisi hasil ekstraksi DICOM seperti StudyDescription, Modality, BodyPartExamined, ukuran citra, frame/video, atau metadata instance, gunakan data itu untuk membuat kesimpulan administratif/teknis yang relevan tanpa mengarang temuan klinis.",
    "8b. Jika terdapat hasil temuan AI Vision (ONNX) (baik berupa onnxResult, hasil/temuan dari model AI Vision, atau yang tertulis di bagian analysis.findings), Anda wajib menyajikan hasil temuan AI Vision tersebut kepada user sebagai temuan AI Vision, dan gunakan aturan 14 untuk memformatnya secara ramah klinis.",
    "9. Jika user meminta gambar, image, viewer, atau menampilkan study, berikan tautan OHIF Viewer dari ohifViewerLinks.",
    "10. Tulis URL OHIF sebagai URL lengkap biasa, bukan format Markdown.",
    "11. Jangan gunakan ohifviewer.herokuapp.com atau parameter ?study=. Gunakan hanya viewerUrl dari ohifViewerLinks.",
    "12. Jangan tampilkan UID teknis, JSON key, atau identifier internal kecuali user secara eksplisit meminta UID, detail teknis, atau tautan viewer.",
    "13. Jangan membuat bagian 'Deskripsi:' yang berisi JSON atau object. Jika ada deskripsi studi, tulis sebagai kalimat biasa.",
    "14. DETEKSI MISMATCH MODALITAS (SANGAT PENTING): Hanya sebutkan mismatch modalitas jika terdapat keterangan 'Peringatan Mismatch Model' secara eksplisit di hasil temuan AI Vision (ONNX) yang ditampilkan. Jika tidak ada peringatan mismatch modalitas, jangan sebutkan ketidaksesuaian modalitas. Asumsikan modalitas sudah sesuai.",
    "15. PENYAJIAN TEMUAN AI VISION — LARANGAN KERAS: DILARANG menyebut angka persentase, skor, atau nilai confidence dalam bentuk apapun (contoh yang DILARANG: '61.1%', '30.6%', 'keyakinan 61%'). Gunakan HANYA deskripsi kualitatif. Petakan temuan menggunakan panduan: (a) Temuan dengan confidence tertinggi → 'indikasi kuat mengarah ke [nama kondisi]' atau 'kemungkinan besar terdapat indikasi [nama kondisi]'. (b) Temuan dengan confidence sedang → 'ada indikasi [nama kondisi], perlu evaluasi lebih lanjut'. (c) Temuan Normal atau confidence rendah → 'tidak ditemukan kelainan signifikan' atau 'kondisi diindikasikan dalam batas normal'. (d) DILARANG menyebut nama file teknis seperti 'ct_chest_0.dcm' — sebut saja sebagai 'citra CT scan' atau 'citra rontgen'. Nyatakan kondisi organ utama secara eksplisit (paru-paru, jantung, otak) dan buat kesimpulan klinis yang jelas. Ingatkan bahwa hasil membutuhkan validasi dokter.",
    "",
    "FORMAT JAWABAN:",
    "- Mulai dengan satu kalimat pembuka yang natural.",
    "- JANGAN menulis ulang metadata pasien baris-demi-baris dengan format 'Label: nilai' di awal jawaban Anda. Mulailah langsung dengan analisis klinis.",
    "- Untuk temuan AI Vision, JANGAN ditulis sebagai format 'Label: nilai%' baris demi baris secara kaku. Tulis dalam bentuk paragraf atau penjelasan klinis yang mengalir dan TANPA angka persentase.",
    "- Jangan menyebut nama file DICOM teknis seperti 'ct_chest_0.dcm'. Gunakan sebutan umum seperti 'citra CT scan dada' atau 'citra rontgen'.",
    "- Untuk tingkat 'Menganalisis data' or 'Menyimpulkan data', tambahkan bagian '**Kesimpulan**' berupa analisis akhir/ringkasan klinis yang utuh dan bagian '**Batasan**' di akhir jawaban.",
    "- Jangan menyebut 'berdasarkan JSON' or 'berdasarkan raw response'.",
    "",
    "DATA DICOM/ORTHANC:",
    normalizedDicomContext,
    "",
    "PERTANYAAN USER:",
    prompt,
  ].join("\n");
}

function buildDicomAnalysisCallbackPrompt(body) {
  const prompt = body?.prompt || body?.question || body?.message || "";
  const context =
    body?.contextText ||
    body?.context ||
    body?.dicomContext ||
    body?.metadata ||
    body?.analysisContext ||
    "";
  const mediaCount = [
    ...(Array.isArray(body?.images) ? body.images : []),
    ...(Array.isArray(body?.frames) ? body.frames : []),
  ].length;

  // Konversi raw ONNX result menjadi ringkasan kualitatif (TANPA angka confidence)
  // Ini mencegah LLM "terpaku" pada angka ONNX dan mengabaikan analisis visual
  const onnxResult = body?.onnxResult || body?.findings;
  let onnxQualitativeSummary = "";
  let mismatchWarning = "";

  if (onnxResult && onnxResult.status === "ok" && Array.isArray(onnxResult.analyzedFiles)) {
    const lines = [];
    for (const file of onnxResult.analyzedFiles) {
      if (file.findings && file.findings.length > 0) {
        const sorted = [...file.findings].sort((a, b) => b.confidence - a.confidence);
        // Hanya ambil temuan signifikan (confidence >= 0.3)
        const significant = sorted.filter(f => f.confidence >= 0.3);
        const top = significant[0] || sorted[0];
        const allLowConf = sorted.every(f => f.confidence < 0.65);

        if (allLowConf) {
          lines.push("Model klasifikasi otomatis tidak memberikan temuan yang meyakinkan — kemungkinan ada ketidaksesuaian antara model dan jenis gambar.");
          mismatchWarning = "Perhatian: Nilai keyakinan model klasifikasi ONNX rendah untuk semua kelas, mengindikasikan kemungkinan ketidaksesuaian antara domain model dan gambar yang dianalisis.";
        } else {
          const desc = confidenceToQualitative(top.confidence, top.label);
          lines.push(`Model klasifikasi otomatis: ${desc.charAt(0).toUpperCase() + desc.slice(1)}.`);
          // Jika ada temuan sekunder signifikan
          const secondary = significant.slice(1).filter(f => f.confidence >= 0.3);
          if (secondary.length > 0) {
            const secDesc = confidenceToQualitative(secondary[0].confidence, secondary[0].label);
            lines.push(`Temuan sekunder: ${secDesc.charAt(0).toUpperCase() + secDesc.slice(1)}.`);
          }
        }
      }
    }
    onnxQualitativeSummary = lines.join(" ") || "Tidak ada temuan signifikan dari model klasifikasi.";
  } else if (typeof onnxResult === "string") {
    // Jika sudah berupa teks (dari onnxFindingsText)
    onnxQualitativeSummary = onnxResult;
    if (onnxResult.includes("Peringatan Mismatch Model")) {
      mismatchWarning = onnxResult.split("Peringatan Mismatch Model:").slice(1).join("").trim();
    }
  } else {
    onnxQualitativeSummary = "Hasil klasifikasi otomatis tidak tersedia.";
  }

  // Juga periksa mismatch dari contextText/onnxFindingsText yang sudah di-build di VM
  const contextStr = typeof context === "string" ? context : "";
  if (!mismatchWarning && contextStr.includes("Peringatan Mismatch Model")) {
    mismatchWarning = contextStr.split("Peringatan Mismatch Model:").slice(1).join("").trim().slice(0, 300);
  }

  const lines = [
    "Kamu adalah AI medis multimodal. Tugasmu adalah menganalisis citra medis DICOM yang dilampirkan secara visual.",
    "Jawab dalam Bahasa Indonesia yang klinis, mendalam, dan informatif.",
    "",
  ];

  if (mediaCount > 0) {
    lines.push(
      `INSTRUKSI UTAMA: ${mediaCount} gambar/frame DICOM telah dilampirkan sebagai input visual.`,
      "Lakukan analisis visual secara langsung terhadap gambar tersebut.",
      "Deskripsikan apa yang kamu LIHAT: struktur anatomi, densitas, kelainan morfologi, distribusi jaringan.",
      "JANGAN hanya mengulangi hasil klasifikasi otomatis — itulah analisis model lain, bukan analisis visualmu.",
      ""
    );
  } else {
    lines.push(
      "PERINGATAN: Tidak ada gambar yang dilampirkan.",
      "Jawab hanya berdasarkan metadata DICOM dan catatan model klasifikasi di bawah.",
      "Sampaikan kepada pembaca bahwa tidak ada analisis visual yang dilakukan.",
      ""
    );
  }

  if (mismatchWarning) {
    lines.push(
      "⚠️ PERINGATAN MISMATCH MODEL:",
      mismatchWarning,
      "Perhatikan bahwa hasil klasifikasi otomatis mungkin tidak relevan untuk gambar ini.",
      ""
    );
  }

  lines.push(
    "FORMAT JAWABAN:",
    "JANGAN menulis ulang metadata pasien (Nama pasien, ID, Modalitas, Tanggal, dll.) di awal jawaban Anda. Bagian ini sudah diisi oleh sistem secara terpisah.",
    "1. **Temuan Visual** — Deskripsikan apa yang terlihat pada citra: organ, tekstur, densitas, area abnormal.",
    "2. **Interpretasi Klinis** — Kaitkan temuan visual dengan kemungkinan kondisi medis.",
    "3. **Catatan Model Klasifikasi** — Sebutkan secara singkat apa yang model otomatis deteksi (gunakan teks di bawah), dan apakah selaras dengan temuan visual.",
    "4. **Batasan & Rekomendasi** — Sampaikan keterbatasan analisis dan anjurkan validasi dokter/radiolog.",
    "",
    "LARANGAN KERAS:",
    "- DILARANG menulis ulang metadata pasien (seperti Nama pasien, ID, Modalitas, Tanggal, dll.) di awal jawaban Anda.",
    "- DILARANG mencantumkan angka persentase atau nilai keyakinan numerik.",
    "- DILARANG menyebut nama file teknis (ct_chest_0.dcm, dll).",
    "- DILARANG menjadikan catatan model klasifikasi sebagai satu-satunya dasar jawaban.",
    "",
    "INFO STUDI (metadata DICOM):",
    contextStr || "Tidak tersedia.",
    "",
    "CATATAN MODEL KLASIFIKASI OTOMATIS (hanya referensi — bukan analisis visual):",
    onnxQualitativeSummary,
    "",
    "PERTANYAAN:",
    prompt || "Analisis hasil pemeriksaan ini secara komprehensif."
  );

  return lines.join("\n");
}




async function handleDicomAnalysisCallback(req, res) {
  try {
    const finalPrompt = buildDicomAnalysisCallbackPrompt(req.body || {});

    // Extract base64 image data for multimodal vision input
    const imagesToSend = [];
    if (req.body && Array.isArray(req.body.images)) {
      req.body.images.forEach((img) => {
        if (img && img.data) {
          imagesToSend.push(img.data);
        }
      });
    }
    // [ISU 4] Log jumlah gambar yang dikirim ke LLM
    console.log(`[handleDicomAnalysisCallback] Images forwarded to LLM: ${imagesToSend.length}`);

    // Gunakan finalPrompt sebagai single user message agar images dapat dilampirkan
    // ke pesan yang sama (multimodal vision).
    // PENTING: Untuk Ollama /api/chat, images HARUS ada di dalam object pesan,
    // bukan di level atas request body.
    const ollamaMessages = [
      {
        role: "user",
        content: finalPrompt,
        images: imagesToSend.length > 0 ? imagesToSend : undefined,
      },
    ];
    const response = await ollamaInstance.post("/chat", {
      model: OLLAMA_MODEL,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: OLLAMA_TEMPERATURE,
        top_p: 0.8,
        repeat_penalty: 1.15,
        num_ctx: 4096,
        num_predict: OLLAMA_NUM_PREDICT,
      },
    });
    let responseText = postProcessAiResponse(
      response.data.message?.content || response.data.response || "",
      req.body?.prompt || "",
      []
    );
    let languageFallbackUsed = false;

    if (hasInvalidResponseLanguage(responseText)) {
      responseText = buildDicomAnalysisCallbackFallback(
        req.body || {},
        "Jawaban model tidak digunakan karena bahasa output tidak sesuai"
      );
      languageFallbackUsed = true;
    } else {
      const structuredBlock = buildStructuredBlockFromCallbackBody(req.body || {});
      if (structuredBlock) {
        responseText = `${structuredBlock}\n\n**Analisis & Penjelasan Klinis (MedGemma):**\n${responseText}`;
      }
    }

    res.json({
      response: responseText,
      skipDicomContext: true,
      languageFallbackUsed,
      imagesProcessed: imagesToSend.length,
      source: "vismed-dicom-analysis-callback",
    });
  } catch (err) {
    const status = err.response?.status || 500;
    logBackendError("DICOM_ANALYSIS_CALLBACK", err);

    res.status(status).json({
      error: "Callback AI DICOM sedang tidak tersedia.",
    });
  }
}

// [ISU 5] Detect domain from prompt keywords (helper extracted for reuse)

function detectDomainFromPrompt(promptLower) {
  if (promptLower.includes("brain") || promptLower.includes("otak") || promptLower.includes("kepala")) {
    return "ct_brain";
  }
  if (promptLower.includes("ct chest") || promptLower.includes("ct dada") || promptLower.includes("ct scan") || promptLower.includes("paru")) {
    return "ct_chest";
  }
  if (promptLower.includes("ekg") || promptLower.includes("ecg")) {
    return "ecg";
  }
  if (promptLower.includes("endoskopi") || promptLower.includes("endoscopy") || promptLower.includes("lambung") || promptLower.includes("kolon")) {
    return "endoscopy";
  }
  return null;
}

async function handleChatbot(req, res) {
  const fs = require("fs");
  let uploadedTempFiles = req.files || [];

  try {
    const prompt = req.query.prompt || req.body?.prompt;

    if (!prompt) {
      return res.status(400).json({ error: "Query prompt wajib diisi" });
    }

    const answerLevel = detectAnswerLevel(prompt);

    // [ISU 3] Read conversation history from frontend (max 6 messages)
    const conversationHistory = Array.isArray(req.body?.history)
      ? req.body.history.slice(-6)
      : [];

    // Initialize image collection for chatbot Vision input
    const chatbotImages = [];
    if (req.body && Array.isArray(req.body.images)) {
      req.body.images.forEach((img) => {
        if (img && img.data) {
          chatbotImages.push(img.data);
        } else if (typeof img === "string") {
          chatbotImages.push(img);
        }
      });
    }

    // Check if any DICOM or standard image files were uploaded
    let uploadedStudyId = null;
    let rawImageAnalysis = null;
    let rawImageDomain = null;
    let rawImageOnnxResult = null;

    if (uploadedTempFiles.length > 0) {
      const dcmFile = uploadedTempFiles.find(
        (f) =>
          f.originalname.toLowerCase().endsWith(".dcm") ||
          f.mimetype === "application/dicom"
      );
      if (dcmFile) {
        try {
          const fileBuffer = fs.readFileSync(dcmFile.path);
          const uploadRes = await orthancInstance.post("/instances", fileBuffer, {
            headers: { "Content-Type": "application/octet-stream" },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          });
          if (uploadRes.data && uploadRes.data.ParentStudy) {
            uploadedStudyId = uploadRes.data.ParentStudy;
            console.log("Successfully uploaded DICOM, got parent study:", uploadedStudyId);
          }
        } catch (uploadErr) {
          console.error("Failed to upload DICOM file to Orthanc:", uploadErr.message);
        }
      } else {
        // Look for standard image file (PNG/JPG/JPEG)
        const rawImgFile = uploadedTempFiles.find(
          (f) =>
            f.originalname.toLowerCase().endsWith(".png") ||
            f.originalname.toLowerCase().endsWith(".jpg") ||
            f.originalname.toLowerCase().endsWith(".jpeg")
        );
        if (rawImgFile) {
          try {
            // [ISU 5] Domain priority: form field > prompt keyword > fallback xray
            const formDomain = req.body?.domain || (req.body?.get ? req.body.get("domain") : null);
            rawImageDomain = formDomain || detectDomainFromPrompt(prompt.toLowerCase()) || "xray";

            console.log(`[handleChatbot] Raw image upload detected. Target domain: ${rawImageDomain} (source: ${formDomain ? 'form' : 'keyword/fallback'})`);

            // Send to VM /analyze-image
            const fileBuffer = fs.readFileSync(rawImgFile.path);
            chatbotImages.push(fileBuffer.toString("base64"));
            const blob = new Blob([fileBuffer], { type: rawImgFile.mimetype });
            const formData = new global.FormData();
            formData.append("domain", rawImageDomain);
            formData.append("image", blob, rawImgFile.originalname);

            const vmAnalyzeUrl = `${DICOM_EXTRACTOR_URL}/analyze-image`;
            console.log(`[handleChatbot] Sending raw image to VM: ${vmAnalyzeUrl}`);
            const vmRes = await axios.post(vmAnalyzeUrl, formData, {
              headers: {
                "Content-Type": "multipart/form-data"
              },
              maxContentLength: 80 * 1024 * 1024,
              maxBodyLength: 80 * 1024 * 1024,
              timeout: 30000,
            });

            if (vmRes.data && vmRes.data.status === "ok" && vmRes.data.analyzedFiles) {
              rawImageOnnxResult = vmRes.data;
              const findingsList = [];
              for (const file of vmRes.data.analyzedFiles) {
                if (file.findings && file.findings.length > 0) {
                  const fileFindings = file.findings.map(f => {
                    const labelLower = f.label.toLowerCase();
                    let formattedLabel = "";
                    if (labelLower === "normal" || labelLower === "norm") {
                      formattedLabel = "Kondisi diindikasikan Normal";
                    } else {
                      formattedLabel = `Terdeteksi indikasi ${f.label}`;
                    }
                    return `- ${formattedLabel} (tingkat keyakinan: ${(f.confidence * 100).toFixed(1)}%)`;
                  }).join("\n");
                  findingsList.push(fileFindings);
                }
              }
              if (findingsList.length > 0) {
                rawImageAnalysis = `Model AI Vision (${rawImageDomain}):\n` + findingsList.join("\n\n");
              } else {
                rawImageAnalysis = `Model AI Vision (${rawImageDomain}): Tidak ditemukan kelainan signifikan oleh AI Vision (ONNX).`;
              }
            }
          } catch (err) {
            console.error("Gagal melakukan analisis gambar mentah via VM:", err.message);
          }
        }
      }
    }

    let dicomContext = "";
    if (uploadedStudyId) {
      dicomContext = await getExtractorContext({ orthancStudyId: uploadedStudyId });
    } else if (rawImageAnalysis) {
      // Build synthetic context for raw image analysis so we don't query Orthanc
      dicomContext = JSON.stringify({
        source: "Raw image analysis upload",
        studiesFound: 1,
        studies: [
          {
            extracted: {
              studyMetadata: {
                StudyDescription: `Raw Image Upload (${rawImageDomain.toUpperCase()})`,
                Modality: rawImageDomain.toUpperCase().startsWith("CT") ? "CT" : "DX",
              },
              sentImages: 1,
              onnxResult: rawImageOnnxResult || {
                status: "ok",
                analyzedFiles: [
                  {
                    filename: "uploaded_image",
                    findings: []
                  }
                ]
              },
              analysis: {
                findings: rawImageAnalysis
              }
            }
          }
        ],
        ohifViewerLinks: []
      }, null, 2);
    } else {
      // No file upload: perform RAG search based on prompt
      dicomContext = await getDicomContext(prompt);
    }

    // Intercept if no studies were found to avoid hallucinated/fabricated metadata from the LLM
    let parsedContext = null;
    try {
      parsedContext = JSON.parse(dicomContext);
    } catch (e) {
      // not JSON
    }

    if (parsedContext && parsedContext.studiesFound === 0) {
      const searchTarget = parsedContext.query?.patientName || parsedContext.query?.patientId || prompt;
      return res.json({
        response: `Pasien atau studi dengan kata kunci "${searchTarget}" tidak ditemukan di Orthanc/PACS. Silakan periksa kembali nama atau ID pasien yang dimasukkan.`,
        answerLevel: answerLevel.name,
        dicomContextUsed: true,
        viewerLinks: [],
      });
    }

    const disambiguationResponse =
      buildStudyDisambiguationResponse(dicomContext);

    if (disambiguationResponse) {
      // [ISU 1] Include candidates array for frontend to render interactive buttons
      let candidatesForFrontend = [];
      try {
        const parsedCtx = JSON.parse(dicomContext);
        candidatesForFrontend = (parsedCtx.candidates || []).map((c) => ({
          orthancStudyId: c.orthancStudyId,
          patientName: normalizeDicomPersonName(c.patientName),
          patientId: c.patientId,
          studyDate: c.studyDate,
          modality: c.modality,
          studyDescription: c.studyDescription,
          seriesCount: c.seriesCount,
        }));
      } catch (_) { /* ignore */ }

      return res.json({
        response: disambiguationResponse,
        answerLevel: "Memilih studi",
        dicomContextUsed: true,
        disambiguationRequired: true,
        candidates: candidatesForFrontend,
        viewerLinks: [],
      });
    }

    const fastDicomResponse = buildFastDicomResponse(
      prompt,
      dicomContext,
      answerLevel
    );

    if (fastDicomResponse) {
      const viewerLinks = isViewerRequest(prompt)
        ? getViewerLinks(prompt, fastDicomResponse, dicomContext)
        : [];

      return res.json({
        response: postProcessAiResponse(
          appendViewerLinksIfNeeded(prompt, fastDicomResponse, dicomContext),
          prompt,
          viewerLinks
        ),
        answerLevel: answerLevel.name,
        dicomContextUsed: Boolean(dicomContext),
        viewerLinks,
        fastResponse: true,
      });
    }

    const finalPrompt = buildPromptWithDicomContext(
      prompt,
      dicomContext,
      answerLevel
    );

    // [ISU 3] Susun messages untuk /chat: history sebagai konteks sebelumnya,
    // finalPrompt sebagai user message terakhir.
    // PENTING: Untuk Ollama /api/chat, images HARUS di dalam message object,
    // bukan di level atas request body.
    console.log(`[handleChatbot] ChatbotImages forwarded to LLM: ${chatbotImages.length}`);
    const ollamaMessages = [
      ...conversationHistory,
      {
        role: "user",
        content: finalPrompt,
        images: chatbotImages.length > 0 ? chatbotImages : undefined,
      },
    ];
    const response = await ollamaInstance.post("/chat", {
      model: OLLAMA_MODEL,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: OLLAMA_TEMPERATURE,
        top_p: 0.8,
        repeat_penalty: 1.2,
        num_ctx: 4096,
        num_predict: OLLAMA_NUM_PREDICT,
      },
    });
    const generatedResponseText = response.data.message?.content || response.data.response || "";
    
    // Build structured metadata and ONNX block
    const structuredBlock = buildStructuredHybridBlock(dicomContext);
    
    let combinedText = generatedResponseText;
    if (structuredBlock) {
      combinedText = `${structuredBlock}\n\n**Analisis & Penjelasan Klinis (MedGemma):**\n${generatedResponseText}`;
    }

    const viewerLinks = isViewerRequest(prompt)
      ? getViewerLinks(prompt, combinedText, dicomContext)
      : [];
    let responseText = postProcessAiResponse(
      appendViewerLinksIfNeeded(prompt, combinedText, dicomContext),
      prompt,
      viewerLinks
    );
    let languageFallbackUsed = false;

    if (hasInvalidResponseLanguage(responseText)) {
      const fallbackResponse = buildDicomMetadataFallbackResponse(
        prompt,
        dicomContext,
        "Jawaban model tidak digunakan karena bahasa output tidak sesuai"
      );

      if (fallbackResponse) {
        responseText = postProcessAiResponse(
          appendViewerLinksIfNeeded(prompt, fallbackResponse, dicomContext),
          prompt,
          viewerLinks
        );
        languageFallbackUsed = true;
      }
    }

    res.json({
      response: responseText,
      answerLevel: answerLevel.name,
      dicomContextUsed: Boolean(dicomContext),
      languageFallbackUsed,
      viewerLinks,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    logBackendError("OLLAMA_CHATBOT", err);

    res.status(status).json({
      error: "Layanan AI sedang tidak tersedia. Silakan coba lagi nanti.",
    });
  } finally {
    // Clean up uploaded temp files
    for (const file of uploadedTempFiles) {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (cleanupErr) {
        console.error("Failed to delete temp file:", file.path, cleanupErr.message);
      }
    }
  }
}

async function getModels(req, res) {
  try {
    const response = await ollamaInstance.get("/tags");
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    logBackendError("OLLAMA_MODELS", err);

    res.status(status).json({
      error: "Daftar model AI belum dapat diambil.",
    });
  }
}

module.exports = {
  handleChatbot,
  handleDicomAnalysisCallback,
  getModels,
};
