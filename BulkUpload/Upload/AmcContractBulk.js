const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const AMCContract = require("../../Model/UploadSchema/AMCContractSchema"); // AMCContract model

// Multer memory storage ka istemal
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// POST /bulk-upload
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // 1. Pehle existing AMCContract documents ko delete karo
    const totalExisting = await AMCContract.countDocuments();
    let deletedCount = 0;

    if (totalExisting > 0) {
      // Saare documents ke _id fetch karo
      const docs = await AMCContract.find({}, { _id: 1 });
      // Ek-ek karke delete karo taki deletion progress track ho sake
      for (const doc of docs) {
        await AMCContract.deleteOne({ _id: doc._id });
        deletedCount++;
        // Agar aapko real-time progress chahiye to aap websockets ya SSE implement kar sakte hain.
      }
    }
    const deletionProgress = totalExisting === 0 ? 100 : Math.round((deletedCount / totalExisting) * 100);

    // 2. Ab excel file ko parse karke naye AMCContract records insert karo
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    const totalRecords = jsonData.length;
    let processed = 0;
    const insertionResults = [];

    for (const record of jsonData) {
      try {
        // Yahan agar date conversion ki zaroorat ho to aap additional conversion kar sakte hain.
        const newAMC = new AMCContract({
          salesdoc: record.salesdoc,
          startdate: record.startdate,
          enddate: record.enddate,
          satypeZDRC_ZDRN: record.satypeZDRC_ZDRN,
          serialnumber: record.serialnumber,
          materialcode: record.materialcode,
          status: record.status
        });
        await newAMC.save();
        insertionResults.push({ serialnumber: record.serialnumber, status: "Created" });
      } catch (error) {
        insertionResults.push({
          serialnumber: record.serialnumber,
          status: "Failed",
          error: error.message
        });
      }
      processed++;
    }

    return res.status(200).json({
      deletion: {
        totalExisting,
        deleted: deletedCount,
        progress: deletionProgress
      },
      insertion: {
        total: totalRecords,
        processed: processed,
        results: insertionResults
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
