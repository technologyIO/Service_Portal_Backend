const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const SpareMaster = require("../../Model/MasterSchema/SpareMasterSchema");
const cors = require('cors');

// Multer memory storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
router.options("/bulk-upload", cors());

// POST /bulk-upload
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.flushHeaders(); // Important for AWS/Nginx

    // Flush headers immediately
    res.flushHeaders();

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      // Ensure data is sent immediately
      if (typeof res.flush === 'function') {
        res.flush();
      }
    };

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

    sendEvent({
      type: 'init',
      data: {
        totalRecords: results.totalRecords,
        message: 'Starting processing...'
      }
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

      // Send progress update
      sendEvent({
        type: 'progress',
        data: {
          processed: results.processed,
          total: results.totalRecords,
          currentStatus: `Processing record ${results.processed} of ${results.totalRecords}`,
          latestRecord: results.details[results.details.length - 1]
        }
      });
    }

    // Final summary
    sendEvent({
      type: 'complete',
      data: {
        summary: {
          totalRecords: results.totalRecords,
          successfullyProcessed: results.processed - results.failed,
          created: results.created,
          updated: results.updated,
          failed: results.failed
        },
        details: results.details
      }
    });

    res.end();

  } catch (error) {
    console.error("Bulk upload error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Server Error",
        message: error.message
      });
    } else {
      // If headers were already sent, try to send error as SSE
      res.write(`event: error\ndata: ${JSON.stringify({
        error: "Server Error",
        message: error.message
      })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;