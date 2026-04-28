var express = require("express");
var router = express.Router();
var axios = require("axios");

function normalizeOllamaHost(host) {
  const cleanHost = host.trim().replace(/\/+$/, "");
  return cleanHost.endsWith("/api") ? cleanHost : `${cleanHost}/api`;
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

const OLLAMA_HOST = normalizeOllamaHost(
  process.env.OLLAMA_HOST 
);
const OLLAMA_MODEL = (process.env.OLLAMA_MODEL || "llama3.2:latest").trim();

const ollamaInstance = axios.create({
  baseURL: OLLAMA_HOST,
  timeout: 120000,
});

router.get("/chatbot", async function (req, res) {
  try {
    const prompt = req.query.prompt;

    if (!prompt) {
      return res.status(400).json({ error: "Query prompt wajib diisi" });
    }

    const response = await ollamaInstance.post("/generate", {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
    });

    res.json({
      response: response.data.response,
      raw: response.data,
    });
  } catch (err) {
    const status = err.response?.status || 500;

    res.status(status).json({ error: getErrorMessage(err) });
  }
});

router.get("/models", async function (req, res) {
  try {
    const response = await ollamaInstance.get("/tags");
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;

    res.status(status).json({ error: getErrorMessage(err) });
  }
});

module.exports = router;
