const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const DealerStock = require("../../Model/UploadSchema/DealerStockSchema");

// Multer memory storage ka istemal
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// POST /bulk-upload
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // 1. Pehle existing DealerStock documents ko delete karo
    const totalExisting = await DealerStock.countDocuments();
    let deletedCount = 0;

    if (totalExisting > 0) {
      // Sare documents ke _id fetch karo aur ek-ek karke delete karo
      const docs = await DealerStock.find({}, { _id: 1 });
      for (const doc of docs) {
        await DealerStock.deleteOne({ _id: doc._id });
        deletedCount++;
      }
    }
    const deletionProgress =
      totalExisting === 0 ? 100 : Math.round((deletedCount / totalExisting) * 100);

    // 2. Excel file ko parse karke naye DealerStock records insert karo
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);
    const totalRecords = jsonData.length;
    let processed = 0;
    const insertionResults = [];

    for (const record of jsonData) {
      try {
        const newDealerStock = new DealerStock({
          dealercodeid: record.dealercodeid,
          dealername: record.dealername,
          dealercity: record.dealercity,
          materialcode: record.materialcode,
          materialdescription: record.materialdescription,
          plant: record.plant,
          unrestrictedquantity: record.unrestrictedquantity,
          status: record.status
        });

        await newDealerStock.save();
        insertionResults.push({
          dealercodeid: record.dealercodeid,
          status: "Created"
        });
      } catch (error) {
        insertionResults.push({
          dealercodeid: record.dealercodeid,
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
        processed,
        results: insertionResults
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
