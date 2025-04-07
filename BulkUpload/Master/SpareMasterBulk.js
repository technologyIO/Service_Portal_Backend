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

    // Excel file ko parse karo
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    const totalRecords = jsonData.length;
    let processed = 0;
    const results = [];

    // Har record ke liye process karo
    for (const record of jsonData) {
      try {
        // Check karo agar same PartNumber already exist karta hai
        const existing = await SpareMaster.findOne({ PartNumber: record.PartNumber });
        let statusMessage = "Created";
        if (existing) {
          // Agar exist karta hai, to use delete karke new record insert karo
          await SpareMaster.deleteOne({ _id: existing._id });
          statusMessage = "Updated";
        }

        // Naya SpareMaster document banayein
        const newSpare = new SpareMaster({
          Sub_grp: record.Sub_grp,
          PartNumber: record.PartNumber,
          Description: record.Description,
          Type: record.Type,
          Rate: record.Rate,
          DP: record.DP,
          Charges: record.Charges,
          spareiamegUrl: record.spareiamegUrl  // New field for image URL
        });

        await newSpare.save();
        results.push({ PartNumber: record.PartNumber, status: statusMessage });
      } catch (error) {
        results.push({ PartNumber: record.PartNumber, status: "Failed", error: error.message });
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
