var express = require("express");
var router = express.Router();

router.post("/", function (req, res) {
  const data = req.body;

  const mwl = {
    PatientName: data.name,
    PatientID: data.id,
    Modality: data.modality,
    StudyDescription: data.study,
  };

  res.json(mwl);
});

module.exports = router;