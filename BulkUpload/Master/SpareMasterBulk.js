const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const SpareMaster = require("../../Model/MasterSchema/SpareMasterSchema");

// Multer memory storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// POST /bulk-upload
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Process the Excel file
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    let jsonData = xlsx.utils.sheet_to_json(worksheet);

    // Initialize counters and results
    const results = {
      totalRecords: jsonData.length,
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      details: []
    };

    // Set up response headers for progressive updates
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked'
    });

    // Process each record sequentially
    for (const [index, record] of jsonData.entries()) {
      try {
        // Pre-process the data
        if (record.Charges === "-") record.Charges = 0;
        
        // Clean numeric fields
        const cleanNumber = (value) => {
          if (typeof value === 'string') {
            return parseFloat(value.replace(/,/g, '')) || 0;
          }
          return value || 0;
        };

        const processedRecord = {
          Sub_grp: record.Sub_grp,
          PartNumber: record.PartNumber,
          Description: record.Description,
          Type: record.Type,
          Rate: cleanNumber(record.Rate),
          DP: cleanNumber(record.DP),
          Charges: cleanNumber(record.Charges),
          spareiamegUrl: record.spareiamegUrl
        };

        // Check for existing record
        const existing = await SpareMaster.findOne({ PartNumber: processedRecord.PartNumber });
        let status = "created";

        if (existing) {
          // Update existing record
          await SpareMaster.findByIdAndUpdate(existing._id, processedRecord);
          status = "updated";
          results.updated++;
        } else {
          // Create new record
          await SpareMaster.create(processedRecord);
          status = "created";
          results.created++;
        }

        // Add to details
        results.details.push({
          recordNumber: index + 1,
          partNumber: processedRecord.PartNumber,
          status,
          message: `Record ${status} successfully`
        });

      } catch (error) {
        results.failed++;
        results.details.push({
          recordNumber: index + 1,
          partNumber: record.PartNumber || 'N/A',
          status: "failed",
          message: error.message
        });
      }

      results.processed++;
      
      // Send progressive updates
      res.write(JSON.stringify({
        progress: {
          processed: results.processed,
          total: results.totalRecords,
          currentStatus: `Processing record ${results.processed} of ${results.totalRecords}`
        },
        latestRecord: results.details[results.details.length - 1]
      }) + '\n');
    }

    // Final summary
    const finalResult = {
      summary: {
        totalRecords: results.totalRecords,
        successfullyProcessed: results.processed - results.failed,
        created: results.created,
        updated: results.updated,
        failed: results.failed
      },
      details: results.details
    };

    res.write(JSON.stringify(finalResult));
    res.end();

  } catch (error) {
    console.error("Bulk upload error:", error);
    res.status(500).json({ 
      error: "Server Error",
      message: error.message 
    });
  }
});

module.exports = router;