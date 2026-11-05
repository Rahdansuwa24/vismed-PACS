const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "80mb" }));

const mwlMake = require("./routes/mwl-server/mwl-make");
const mwlRead = require("./routes/mwl-server/mwl-read");
const uploadImages = require("./routes/convert-dicom/upload-dicom-images");
const uploadVideos = require("./routes/convert-dicom/upload-dicom-videos");
const dicomMcpRouter = require("./routes/dicom-mcp/index");
const decodeDicomRouter = require("./routes/decode-dicom/index");
const axios = require("axios");

app.use("/api", mwlMake);
app.use("/api", mwlRead);
app.use("/api", uploadImages);
app.use("/api", uploadVideos);
app.use("/api/decode-dicom", decodeDicomRouter);
app.use("/dicom-mcp", dicomMcpRouter);

// Proxy endpoint ke Ollama Server
const ollamaProxy = express.Router();
ollamaProxy.use(async (req, res) => {
  try {
    const cleanUrl = req.url.replace(/^\/api/, "");
    const targetUrl = `http://10.9.23.205:11434/api${cleanUrl}`;
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      timeout: 120000,
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    console.error("Ollama Proxy Error:", err.message);
    const status = err.response?.status || 500;
    res.status(status).json(err.response?.data || { error: err.message });
  }
});
app.use("/api/ollama", ollamaProxy);

app.listen(4000, "0.0.0.0", () => {
  console.log("🚀 MWL SERVER RUNNING ON 4000");
});
