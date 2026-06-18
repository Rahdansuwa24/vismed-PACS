var express = require("express");
var router = express.Router();
var aiController = require("../controllers/ai");
const multer = require("multer");
const upload = multer({ dest: "tmp/" });

router.get("/chatbot", aiController.handleChatbot);
router.post("/chatbot", upload.array("files"), aiController.handleChatbot);
router.post("/dicom-analysis", aiController.handleDicomAnalysisCallback);
router.get("/models", aiController.getModels);

module.exports = router;
