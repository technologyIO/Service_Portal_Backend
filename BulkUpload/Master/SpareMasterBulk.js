const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const SpareMaster = require("../../Model/MasterSchema/SpareMasterSchema"); // Mongoose model

// Multer memory storage ka istemal
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// POST /bulk-upload
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    let jsonData = xlsx.utils.sheet_to_json(worksheet);

    // Pre-process the data to handle special cases
    jsonData = jsonData.map(record => {
      // Convert "-" to 0 or null for numeric fields
      if (record.Charges === "-") {
        record.Charges = 0; // or null if you prefer
      }

      // Also handle commas in numbers (like "9,565" -> 9565)
      if (typeof record.Rate === "string") {
        record.Rate = parseFloat(record.Rate.replace(/,/g, ''));
      }
      if (typeof record.DP === "string") {
        record.DP = parseFloat(record.DP.replace(/,/g, ''));
      }
      if (typeof record.Charges === "string") {
        record.Charges = parseFloat(record.Charges.replace(/,/g, ''));
      }

      return record;
    });

    const totalRecords = jsonData.length;
    let processed = 0;
    const results = [];

    for (const record of jsonData) {
      try {
        const existing = await SpareMaster.findOne({ PartNumber: record.PartNumber });
        let statusMessage = "Created";

        if (existing) {
          await SpareMaster.deleteOne({ _id: existing._id });
          statusMessage = "Updated";
        }

        const newSpare = new SpareMaster({
          Sub_grp: record.Sub_grp,
          PartNumber: record.PartNumber,
          Description: record.Description,
          Type: record.Type,
          Rate: record.Rate || 0,  // Default to 0 if empty
          DP: record.DP || 0,      // Default to 0 if empty
          Charges: record.Charges || 0, // Default to 0 if empty or "-"
          spareiamegUrl: record.spareiamegUrl
        });

        await newSpare.save();
        results.push({ PartNumber: record.PartNumber, status: statusMessage });
      } catch (error) {
        results.push({
          PartNumber: record.PartNumber,
          status: "Failed",
          error: error.message
        });
      }
      processed++;
    }

    return res.status(200).json({
      total: totalRecords,
      processed: processed,
      results: results
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
