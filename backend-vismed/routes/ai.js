var express = require("express");
var router = express.Router();
var axios = require("axios");

const PACS_URL = process.env.PACS_URL;

router.get("/chatbot", async function (req, res) {
  try {
    const response = await axios.get(`${PACS_URL}/studies`);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;