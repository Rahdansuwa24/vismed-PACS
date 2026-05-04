var express = require("express");
var router = express.Router();
var axios = require("axios");

function normalizeOllamaHost(host) {
  const cleanHost = host.trim().replace(/\/+$/, "");
  return cleanHost.endsWith("/api") ? cleanHost : `${cleanHost}/api`;
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

const OLLAMA_HOST = normalizeOllamaHost(
  process.env.OLLAMA_HOST || "http://10.9.23.205:11434/api"
);
const OLLAMA_MODEL = (process.env.OLLAMA_MODEL || "llama3.2:latest").trim();
const DICOM_BRIDGE_URL = normalizeBaseUrl(process.env.DICOM_BRIDGE_URL);
const DICOM_CONTEXT_ENABLED = process.env.DICOM_CONTEXT_ENABLED !== "false";
const PACS_URL = normalizeBaseUrl(process.env.PACS_URL);
const OHIF_VIEWER_URL = normalizeBaseUrl(
  process.env.OHIF_VIEWER_URL || (PACS_URL ? `${PACS_URL}/ohif/viewer` : "")
);

const ollamaInstance = axios.create({
  baseURL: OLLAMA_HOST,
  timeout: 120000,
});

const dicomBridgeInstance = axios.create({
  baseURL: DICOM_BRIDGE_URL,
  timeout: 60000,
});

function shouldUseDicomContext(prompt) {
  return /dicom|orthanc|pacs|patient|pasien|nama\s*pasien|study|studi|series|modality|modalitas|ct|mri|xray|rontgen|accession|rekam\s*medis|no\.?\s*rm|nomor\s*rm|medical\s*record/i.test(
    prompt
  );
}

function extractDicomQuery(prompt) {
  const patientIdMatch = prompt.match(
    /(?:patient\s*id|id\s*pasien|patientid|rekam\s*medis|no\.?\s*rm|nomor\s*rm|medical\s*record(?:\s*number)?)\s*[:=]?\s*([A-Za-z0-9_.-]+)/i
  );
  const patientNameMatch = prompt.match(
    /(?:nama\s*pasien|patient\s*name|name)\s*[:=]?\s*([A-Za-z0-9 ._-]+?)(?=\s+(?:dan|dengan|rekam\s*medis|no\.?\s*rm|nomor\s*rm|patient\s*id|id\s*pasien|medical\s*record)\b|$)/i
  );

  return {
    patientId: patientIdMatch?.[1],
    patientName: patientNameMatch?.[1]?.trim(),
  };
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

async function getDicomContext(prompt) {
  if (!DICOM_CONTEXT_ENABLED || !DICOM_BRIDGE_URL || !shouldUseDicomContext(prompt)) {
    return "";
  }

  const { patientId, patientName } = extractDicomQuery(prompt);

  if (!patientId && !patientName) {
    return [
      "User menanyakan data DICOM/PACS, tetapi belum memberikan patient ID atau nama pasien yang spesifik.",
      "Minta user menyertakan patient ID atau nama pasien agar data Orthanc bisa dicari.",
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

function buildPromptWithDicomContext(prompt, dicomContext) {
  if (!dicomContext) {
    return prompt;
  }

  return [
    "Kamu adalah asisten medis untuk sistem PACS.",
    "Gunakan DATA DICOM/ORTHANC berikut sebagai konteks.",
    "Jawab dalam bahasa Indonesia yang ringkas dan mudah dibaca.",
    "Jangan tampilkan JSON mentah, struktur object, array, key-value teknis, atau raw response kepada user.",
    "Jika perlu menyebut data, ubah menjadi kalimat atau daftar poin sederhana.",
    "Jika user meminta gambar, image, viewer, atau menampilkan study, berikan tautan OHIF Viewer dari ohifViewerLinks.",
    "Tulis URL OHIF sebagai URL lengkap biasa, bukan format Markdown.",
    "Jangan gunakan ohifviewer.herokuapp.com atau parameter ?study=. Gunakan hanya viewerUrl dari ohifViewerLinks.",
    "Jangan mengarang data pasien, study, series, atau diagnosis yang tidak ada di konteks.",
    "Jika konteks tidak cukup, jelaskan data apa yang perlu dilengkapi.",
    "",
    "DATA DICOM/ORTHANC:",
    dicomContext,
    "",
    "PERTANYAAN USER:",
    prompt,
  ].join("\n");
}

router.get("/chatbot", async function (req, res) {
  try {
    const prompt = req.query.prompt;

    if (!prompt) {
      return res.status(400).json({ error: "Query prompt wajib diisi" });
    }

    const dicomContext = await getDicomContext(prompt);
    const finalPrompt = buildPromptWithDicomContext(prompt, dicomContext);

    const response = await ollamaInstance.post("/generate", {
      model: OLLAMA_MODEL,
      prompt: finalPrompt,
      stream: false,
    });
    const responseText = appendViewerLinksIfNeeded(
      prompt,
      response.data.response || "",
      dicomContext
    );
    const viewerLinks = isViewerRequest(prompt)
      ? getViewerLinks(prompt, responseText, dicomContext)
      : [];

    res.json({
      response: responseText,
      dicomContextUsed: Boolean(dicomContext),
      viewerLinks,
      raw: response.data,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    logBackendError("OLLAMA_CHATBOT", err);

    res.status(status).json({
      error: "Layanan AI sedang tidak tersedia. Silakan coba lagi nanti.",
    });
  }
});

router.get("/models", async function (req, res) {
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
});

module.exports = router;
