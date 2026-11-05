const express = require("express");
const fs = require("fs/promises");
const { exec } = require("child_process");
const util = require("util");

const router = express.Router();
const execPromise = util.promisify(exec);

const WORKLIST_DIR = "/var/lib/orthanc/worklists";

// helper
function getValue(data, tag) {
  return data[tag]?.Value?.[0] || null;
}

function getSPS(data, tag) {
  return data["00400100"]?.Value?.[0]?.[tag]?.Value?.[0] || null;
}

function formatPN(pn) {
  if (!pn) return null;

  if (typeof pn === "object" && pn.Alphabetic) {
    return pn.Alphabetic.replace(/\^/g, " ");
  }

  if (typeof pn === "string") {
    return pn.replace(/\^/g, " ");
  }

  return pn;
}

function formatTime(t) {
  if (!t) return null;
  return `${t.slice(0,2)}:${t.slice(2,4)}`;
}

function formatDate(d) {
  if (!d) return null;
  return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
}

// GET MWL
router.get("/mwl-get", async (req, res) => {
  try {
    const files = await fs.readdir(WORKLIST_DIR);
    const wlFiles = files.filter(f => f.endsWith(".wl"));

    let results = [];

    for (const file of wlFiles) {
      try {
        const { stdout } = await execPromise(
          `dcm2json ${WORKLIST_DIR}/${file}`
        );

        const data = JSON.parse(stdout);

        results.push({
          id: getValue(data, "00100020"),
          name: formatPN(getValue(data, "00100010")),
          modality: getSPS(data, "00080060"),
          bodypart: getSPS(data, "00400007"),
          date: formatDate(getSPS(data, "00400002")),
          time: formatTime(getSPS(data, "00400003")),
          accessionNumber: getValue(data, "00080050"),
          sex: getValue(data, "00100040"),
          dob: formatDate(getValue(data, "00100030")),
          aet: getSPS(data, "00400001"),
        });

      } catch (err) {
        console.error("Error parsing:", file);
      }
    }

    res.json(results);

  } catch (err) {
    console.log(err)
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
