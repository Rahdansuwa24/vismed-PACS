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
const OLLAMA_MODEL = (
  process.env.OLLAMA_MODEL || "MedAIBase/MedGemma1.5:4b"
).trim();
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.2);
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
    /simpul|kesimpulan|ringkas|rangkuman|resume|ikhtisar|impression|summary/i.test(
      text
    )
  ) {
    return {
      name: "Menyimpulkan data",
      instruction:
        "Buat kesimpulan singkat berdasarkan data yang tersedia. Bedakan fakta dari interpretasi. Jika data hanya metadata Orthanc, simpulkan secara administratif dan jangan membuat diagnosis klinis.",
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
        "Analisis hubungan antar-data yang tersedia, misalnya identitas pasien, modalitas, tanggal studi, deskripsi studi, dan ketersediaan tautan viewer. Jangan menyimpulkan temuan radiologi atau diagnosis jika citra/laporan klinis tidak ada di konteks.",
    };
  }

  return {
    name: "Membacakan data",
    instruction:
      "Bacakan data objektif yang tersedia saja. Jangan menambah interpretasi, diagnosis, atau informasi di luar konteks.",
  };
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
  return String(responseText || "")
    .replace(/```+/g, "")
    .replace(/^Tentu,\s*/i, "")
    .replace(/^\s*[*-]\s+/gm, "")
    .replace(/\bStudy ID\b/g, "ID studi")
    .replace(/\bStudyID\b/g, "ID studi")
    .replace(/\bStudy\b/g, "Studi")
    .replace(/\bSeries\b/g, "Seri")
    .replace(/\bInstance\b/g, "Instance")
    .replace(/Nama Pasien/g, "Nama pasien")
    .replace(/ID Pasien/g, "ID pasien")
    .replace(/Nomor Rekam Medis/g, "Nomor rekam medis")
    .replace(/Tanggal Studi/g, "Tanggal studi")
    .replace(/Deskripsi Studi/g, "Deskripsi studi")
    .replace(/Jumlah seri terkait Studi/g, "Jumlah seri terkait")
    .replace(/Jumlah instance terkait Studi/g, "Jumlah instance terkait")
    .replace(/Jumlah Seri Terkait/g, "Jumlah seri terkait")
    .replace(/Jumlah Instance Terkait/g, "Jumlah instance terkait")
    .replace(
      /\b(20\d{2})(\d{2})(\d{2})\b/g,
      (_, year, month, day) => `${year}-${month}-${day}`
    );
}

function removeEmptyLabelLines(responseText) {
  return String(responseText || "")
    .split("\n")
    .filter((line) => !/^\s*(?:id\s*studi|studi\s*id)\s*:\s*$/i.test(line))
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

  return lines
    .filter((line, index) => {
      if (!/^\s*(?:analisis|kesimpulan|batasan)\s*:\s*$/i.test(line)) {
        return true;
      }

      const nextMeaningfulLine = lines
        .slice(index + 1)
        .find((item) => item.trim());

      return Boolean(nextMeaningfulLine) && !/^\s*(?:analisis|kesimpulan|batasan)\s*:/i.test(nextMeaningfulLine);
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

function postProcessAiResponse(responseText, prompt, viewerLinks) {
  const allowedViewerUrls = viewerLinks.map((link) => link.viewerUrl);

  return capitalizeFirstLetter(
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
    "Jawab dalam bahasa Indonesia yang baik, jelas, ringkas, dan sesuai EYD/PUEBI.",
    `Tingkat jawaban: ${answerLevel.name}.`,
    answerLevel.instruction,
    "",
    "ATURAN WAJIB:",
    "1. Jangan mengarang data pasien, study, series, temuan klinis, diagnosis, atau tindakan medis yang tidak ada di konteks.",
    "2. Jika suatu informasi tidak ada di konteks, tulis bahwa data tersebut tidak tersedia.",
    "3. Ubah format nama DICOM yang memakai tanda ^ menjadi nama manusiawi, misalnya byan^sujatmiko^kuncoro menjadi Byan Sujatmiko Kuncoro.",
    "4. Jangan tampilkan JSON mentah, struktur object, array, key-value teknis, atau raw response kepada user.",
    "5. Jika perlu menyebut data, ubah menjadi kalimat atau daftar poin sederhana.",
    "6. Gunakan istilah baku: pasien, studi, modalitas, tanggal studi, deskripsi studi, dan nomor rekam medis.",
    "7. Jika user meminta analisis atau kesimpulan tetapi konteks hanya berisi metadata, nyatakan batasannya dengan sopan.",
    "8. Jika user meminta gambar, image, viewer, atau menampilkan study, berikan tautan OHIF Viewer dari ohifViewerLinks.",
    "9. Tulis URL OHIF sebagai URL lengkap biasa, bukan format Markdown.",
    "10. Jangan gunakan ohifviewer.herokuapp.com atau parameter ?study=. Gunakan hanya viewerUrl dari ohifViewerLinks.",
    "11. Jangan tampilkan UID teknis, JSON key, atau identifier internal kecuali user secara eksplisit meminta UID, detail teknis, atau tautan viewer.",
    "12. Jangan membuat bagian 'Deskripsi:' yang berisi JSON atau object. Jika ada deskripsi studi, tulis sebagai kalimat biasa.",
    "",
    "FORMAT JAWABAN:",
    "- Mulai dengan satu kalimat pembuka yang natural.",
    "- Tulis setiap data penting pada baris baru dengan format 'Label: nilai'.",
    "- Jangan gunakan tanda bintang, bullet markdown, atau simbol daftar di awal baris.",
    "- Jika ingin menekankan label, gunakan format tebal sederhana seperti **Nama pasien:**.",
    "- Untuk tingkat 'Menganalisis data', tambahkan bagian 'Analisis' setelah data objektif.",
    "- Untuk tingkat 'Menyimpulkan data', tambahkan bagian 'Kesimpulan' dan 'Batasan'.",
    "- Jangan menyebut 'berdasarkan JSON' atau 'berdasarkan raw response'.",
    "",
    "DATA DICOM/ORTHANC:",
    normalizedDicomContext,
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
    const answerLevel = detectAnswerLevel(prompt);
    const finalPrompt = buildPromptWithDicomContext(
      prompt,
      dicomContext,
      answerLevel
    );

    const response = await ollamaInstance.post("/generate", {
      model: OLLAMA_MODEL,
      prompt: finalPrompt,
      stream: false,
      options: {
        temperature: OLLAMA_TEMPERATURE,
        top_p: 0.8,
        repeat_penalty: 1.2,
        num_predict: 350,
      },
    });
    const generatedResponseText = response.data.response || "";
    const viewerLinks = isViewerRequest(prompt)
      ? getViewerLinks(prompt, generatedResponseText, dicomContext)
      : [];
    const responseText = postProcessAiResponse(
      appendViewerLinksIfNeeded(prompt, generatedResponseText, dicomContext),
      prompt,
      viewerLinks
    );

    res.json({
      response: responseText,
      answerLevel: answerLevel.name,
      dicomContextUsed: Boolean(dicomContext),
      viewerLinks,
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
