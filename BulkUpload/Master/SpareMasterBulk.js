const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const SpareMaster = require('../../Model/MasterSchema/SpareMasterSchema');
const cors = require('cors');

// Configure multer with memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Enable CORS pre-flight for bulk-upload
router.options('/bulk-upload', cors());

/** Helper function to clean and convert numeric values */
function cleanNumber(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove commas and any non-numeric characters except decimal point
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  // Initialize response object with streaming support
  const response = {
    status: 'processing',
    startTime: new Date(),
    totalRecords: 0,
    processedRecords: 0,
    createdCount: 0,
    updatedCount: 0,
    errorCount: 0,
    currentRecord: null,
    errors: [],
    message: 'Starting processing'
  };

  try {
    if (!req.file) {
      response.status = 'failed';
      response.errors.push('No file uploaded');
      return res.status(400).json(response);
    }

    // Set headers for streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Read and parse Excel file
    const workbook = XLSX.read(req.file.buffer, {
      type: 'buffer',
      cellDates: true,
      raw: false // Get formatted strings for dates
    });
    
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    response.totalRecords = jsonData.length;
    response.message = `Found ${response.totalRecords} records to process`;

    // Send initial response
    res.write(JSON.stringify(response) + '\n');

    // Process records in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
      const batch = jsonData.slice(i, i + BATCH_SIZE);

      for (const [index, record] of batch.entries()) {
        const absoluteIndex = i + index;
        response.currentRecord = {
          partNumber: record.PartNumber || 'Unknown',
          description: record.Description || 'Unknown',
          index: absoluteIndex + 1
        };
        response.processedRecords = absoluteIndex + 1;
        response.message = `Processing record ${absoluteIndex + 1} of ${response.totalRecords}`;

        try {
          // Validate required fields
          const requiredFields = ['PartNumber', 'Description', 'Type', 'Rate'];
          const missingFields = requiredFields.filter(field => !record[field]);
          if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
          }

          // Prepare document with cleaned data
          const doc = {
            Sub_grp: record.Sub_grp || '',
            PartNumber: record.PartNumber,
            Description: record.Description,
            Type: record.Type,
            Rate: cleanNumber(record.Rate),
            DP: cleanNumber(record.DP),
            Charges: record.Charges === '-' ? 0 : cleanNumber(record.Charges),
            spareiamegUrl: record.spareiamegUrl || ''
          };

          // Check for existing record
          const existingRecord = await SpareMaster.findOne({ PartNumber: doc.PartNumber });

          if (existingRecord) {
            // Update existing record
            await SpareMaster.findByIdAndUpdate(existingRecord._id, doc);
            response.updatedCount++;
            response.message = `Updated record ${doc.PartNumber}`;
          } else {
            // Create new record
            await SpareMaster.create(doc);
            response.createdCount++;
            response.message = `Created record ${doc.PartNumber}`;
          }
        } catch (error) {
          response.errorCount++;
          response.errors.push({
            record: record.PartNumber || 'Unknown',
            description: record.Description || 'Unknown',
            error: error.message
          });
        }

        // Send progress update after each record
        res.write(JSON.stringify(response) + '\n');
      }
    }

    // Finalize response
    response.status = 'completed';
    response.endTime = new Date();
    response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;
    response.message = `Processing completed. Created: ${response.createdCount}, Updated: ${response.updatedCount}, Errors: ${response.errorCount}`;
    
    res.write(JSON.stringify(response) + '\n');
    res.end();

  } catch (error) {
    console.error('Bulk upload error:', error);
    
    // If headers were already sent, try to send the error as the last chunk
    if (res.headersSent) {
      response.status = 'failed';
      response.endTime = new Date();
      response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;
      response.errors.push(error.message);
      response.message = 'Processing failed due to unexpected error';
      
      res.write(JSON.stringify(response) + '\n');
      res.end();
    } else {
      // If headers weren't sent, send a normal error response
      response.status = 'failed';
      response.endTime = new Date();
      response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;
      response.errors.push(error.message);
      response.message = 'Processing failed due to unexpected error';
      
      res.status(500).json(response);
    }
  }
});

module.exports = router;