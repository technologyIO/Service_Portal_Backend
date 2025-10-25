const express = require('express');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const multer = require('multer');
const { Readable } = require('stream');
const PendingComplaints = require('../../Model/UploadSchema/PendingCompliantsSchema');

const router = express.Router();

// Optimized: Pre-compiled regex patterns
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]/g;
const MULTISPACE_REGEX = /\s+/g;

// Memory storage with optimized settings
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    console.log('File details:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv',
      'text/plain', // Sometimes CSV comes as plain text
      'application/octet-stream' // Generic binary, check extension
    ];

    const fileName = file.originalname.toLowerCase();
    const isValidExtension = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv');
    const isValidMimeType = allowedMimeTypes.includes(file.mimetype);

    if (isValidMimeType || isValidExtension) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format. Received: ${file.mimetype}, File: ${file.originalname}`), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Updated FIELD_MAPPINGS with all SAP variations
// Updated FIELD_MAPPINGS with properly normalized versions
const FIELD_MAPPINGS = {
  'notificationtype': new Set([
    'notificationtype', 'notification type', 'type', 'notifictn type', 'notifctntype', 'notifictntype' // Added normalized version
  ]),
  'notification_complaintid': new Set([
    'notificationcomplaintid', 'notification/complaint id', 'complaintid', 'ticketid',
    'notification', 'complaint id', 'notification id', 'notificationid'
  ]),
  'notificationdate': new Set([
    'notificationdate', 'notification date', 'date', 'notifdate', 'notifdate', // Added normalized version
    'complaint date', 'created date'
  ]),
  'userstatus': new Set([
    'userstatus', 'user status', 'status', 'complaint status'
  ]),
  'materialdescription': new Set([
    'materialdescription', 'material description', 'description', 'material desc',
    'product description', 'item description'
  ]),
  'serialnumber': new Set([
    'serialnumber', 'serial number', 'sno', 's-no', 'serial no', 'serialno'
  ]),
  'devicedata': new Set([
    'devicedata', 'device data', 'device info', 'equipment data'
  ]),
  'salesoffice': new Set([
    'salesoffice', 'sales office', 'office', 'branch office'
  ]),
  'materialcode': new Set([
    'materialcode', 'material code', 'code', 'material', 'product code',
    'item code', 'part code'
  ]),
  'reportedproblem': new Set([
    'reportedproblem', 'reported problem', 'problem', 'description', 'issue',
    'complaint description', 'problem description'
  ]),
  'dealercode': new Set([
    'dealercode', 'dealer code', 'partnerresp', 'partnerresp.', 'partner code', 'vendor code', // Added normalized versions
    'supplier code'
  ]),
  'customercode': new Set([
    'customercode', 'customer code', 'customer', 'client code', 'cust code'
  ]),
  'partnerresp': new Set([
    'partnerresp', 'partnerresp.', 'partner response', 'partner resp',
    'vendor response', 'dealer response'
  ]),
  'breakdown': new Set([
    'breakdown', 'break down', 'failure', 'malfunction'
  ])
};


// Optimized normalizeFieldName with memoization
const normalizedFieldCache = new Map();
function normalizeFieldName(fieldName) {
  if (!fieldName) return '';
  if (normalizedFieldCache.has(fieldName)) {
    return normalizedFieldCache.get(fieldName);
  }
  const normalized = fieldName
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_REGEX, '')
    .trim();
  normalizedFieldCache.set(fieldName, normalized);
  return normalized;
}

// Optimized header mapping with early exit
function mapHeaders(headers) {
  const mappedHeaders = {};
  const seenFields = new Set();

  for (const header of headers) {
    const normalizedHeader = normalizeFieldName(header);

    // Skip if we've already mapped this exact header
    if (seenFields.has(normalizedHeader)) continue;
    seenFields.add(normalizedHeader);

    // Find the first matching schema field
    for (const [schemaField, variations] of Object.entries(FIELD_MAPPINGS)) {
      if (variations.has(normalizedHeader)) {
        mappedHeaders[header] = schemaField;
        break; // Move to next header once we find a match
      }
    }
  }

  return mappedHeaders;
}

// Optimized Excel parsing with buffer reuse
function parseExcelFile(buffer) {
  try {
    console.log('Excel buffer size:', buffer.length);

    // Try different read options for better compatibility
    let workbook;
    try {
      workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false,
        raw: false,
        codepage: 65001 // UTF-8
      });
    } catch (readError) {
      console.log('First read attempt failed, trying alternative options...');
      workbook = XLSX.read(buffer, {
        type: 'buffer',
        raw: true
      });
    }

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('No worksheets found in Excel file');
    }

    const sheetName = workbook.SheetNames[0];
    console.log('Processing sheet:', sheetName);

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error(`Worksheet "${sheetName}" not found`);
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      raw: false,
      dateNF: 'yyyy-mm-dd',
      cellDates: true
    });

    console.log('Excel parsing successful, rows:', jsonData.length);
    return jsonData;

  } catch (error) {
    console.error('Excel parsing error:', error);
    throw new Error(`Excel parsing failed: ${error.message}`);
  }
}

// Optimized CSV parsing with stream control
function parseCSVFile(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const csvString = buffer.toString('utf8');

    console.log('CSV string length:', csvString.length);
    console.log('CSV preview:', csvString.substring(0, 200));

    if (!csvString.trim()) {
      return reject(new Error('CSV file appears to be empty'));
    }

    const stream = Readable.from(csvString)
      .pipe(csv({
        mapValues: ({ value }) => value ? value.trim() : '',
        strict: false, // More lenient parsing
        skipLines: 0,
        skipEmptyLines: true,
        maxRowBytes: 10000, // Handle large rows
        headers: true
      }))
      .on('data', (data) => {
        // Filter out completely empty rows
        const hasData = Object.values(data).some(val => val && val.toString().trim());
        if (hasData) {
          results.push(data);
        }
      })
      .on('end', () => {
        console.log('CSV parsing successful, rows:', results.length);
        resolve(results);
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        reject(new Error(`CSV parsing failed: ${error.message}`));
      });

    // Set timeout for parsing
    setTimeout(() => {
      if (!stream.destroyed) {
        stream.destroy();
        reject(new Error('CSV parsing timeout'));
      }
    }, 30000); // 30 second timeout
  });
}

// Optimized record validation with early exits
function validateRecord(record, headerMapping) {
  const cleanedRecord = {};
  const providedFields = [];
  const errors = [];

  // Map headers to schema fields
  for (const [originalHeader, schemaField] of Object.entries(headerMapping)) {
    if (record[originalHeader] === undefined || record[originalHeader] === null) continue;

    const value = String(record[originalHeader]).trim();
    if (value === '' || value === 'undefined' || value === 'null') continue;

    cleanedRecord[schemaField] = value.replace(MULTISPACE_REGEX, ' ').trim();
    providedFields.push(schemaField);
  }

  // Required field validation
  if (!cleanedRecord.notification_complaintid) {
    errors.push('Notification/Complaint ID is required');
  }
  if (!cleanedRecord.materialdescription) {
    errors.push('Material Description is required');
  }

  // Early exit if required fields are missing
  if (errors.length > 0) {
    return { cleanedRecord, errors, providedFields };
  }

  // Length validation
  if (cleanedRecord.notification_complaintid.length > 100) {
    errors.push('Notification/Complaint ID too long (max 100 characters)');
  }
  if (cleanedRecord.materialdescription.length > 500) {
    errors.push('Material Description too long (max 500 characters)');
  }

  return { cleanedRecord, errors, providedFields };
}

// MAIN ROUTE - Updated with FULL DELETE & UPLOAD functionality
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  const BATCH_SIZE = 2000;
  const PARALLEL_BATCHES = 3;

  // Initialize response object with optimized structure
  const response = {
    status: 'processing',
    startTime: new Date(),
    totalRecords: 0,
    processedRecords: 0,
    successfulRecords: 0,
    failedRecords: 0,
    deletedRecords: 0, // New field for tracking deletions
    results: [],
    summary: {
      created: 0,
      updated: 0,
      failed: 0,
      duplicatesInFile: 0,
      deleted: 0, // New field for deleted records
      skippedTotal: 0
    },
    headerMapping: {},
    errors: [],
    warnings: [],
    batchProgress: {
      currentBatch: 0,
      totalBatches: 0,
      batchSize: BATCH_SIZE,
      currentBatchRecords: 0
    },
    deleteOperation: {
      status: 'pending',
      deletedCount: 0,
      message: ''
    }
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
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Parse file with optimized method selection
    let jsonData;
    const fileName = req.file.originalname.toLowerCase();
    const mimeType = req.file.mimetype;

    console.log('Parsing file:', { fileName, mimeType, bufferSize: req.file.buffer.length });
    try {
      // Determine file type by extension AND content
      if (fileName.endsWith('.csv') || mimeType.includes('csv') || mimeType === 'text/plain') {
        console.log('Parsing as CSV...');
        jsonData = await parseCSVFile(req.file.buffer);
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ||
        mimeType.includes('spreadsheet') || mimeType.includes('excel') ||
        mimeType === 'application/octet-stream') {
        console.log('Parsing as Excel...');
        jsonData = parseExcelFile(req.file.buffer);
      } else {
        throw new Error(`Unsupported file format. File: ${fileName}, MIME: ${mimeType}`);
      }
    } catch (parseError) {
      console.error('File parsing failed:', parseError);
      response.status = 'failed';
      response.errors.push(`File parsing error: ${parseError.message}`);
      return res.status(400).json(response);
    }

    response.totalRecords = jsonData.length;
    response.batchProgress.totalBatches = Math.ceil(jsonData.length / BATCH_SIZE);

    // Map headers with optimized method
    const headers = Object.keys(jsonData[0] || {});
    const headerMapping = mapHeaders(headers);
    response.headerMapping = headerMapping;

    console.log('Header mapping:', headerMapping);
    console.log('Available headers:', headers);
    console.log('Mapped fields:', Object.values(headerMapping));

    // Check for required fields with optimized lookup
    const hasRequiredFields = ['notification_complaintid', 'materialdescription'].every(field =>
      Object.values(headerMapping).includes(field)
    );
    if (!hasRequiredFields) {
      response.status = 'failed';
      response.errors.push(
        `Required headers not found: Notification/Complaint ID or Material Description. Available headers: ${headers.join(', ')}`
      );
      return res.status(400).json(response);
    }

    // Send initial response
    res.write(JSON.stringify(response) + '\n');

    // **FULL DELETE OPERATION** - Delete all existing complaints before upload
    try {
      response.deleteOperation.status = 'in-progress';
      response.deleteOperation.message = 'Deleting all existing pending complaints...';

      // Send delete progress update
      res.write(JSON.stringify({
        ...response,
        deleteOperation: response.deleteOperation
      }) + '\n');

      console.log('Starting full delete operation...');
      const deleteResult = await PendingComplaints.deleteMany({});

      response.deleteOperation.status = 'completed';
      response.deleteOperation.deletedCount = deleteResult.deletedCount;
      response.deleteOperation.message = `Successfully deleted ${deleteResult.deletedCount} existing complaints`;
      response.summary.deleted = deleteResult.deletedCount;
      response.deletedRecords = deleteResult.deletedCount;

      console.log(`Deleted ${deleteResult.deletedCount} existing complaints`);

      // Send delete completion update
      res.write(JSON.stringify({
        ...response,
        deleteOperation: response.deleteOperation
      }) + '\n');

    } catch (deleteError) {
      console.error('Delete operation failed:', deleteError);
      response.deleteOperation.status = 'failed';
      response.deleteOperation.message = `Delete operation failed: ${deleteError.message}`;
      response.errors.push(`Failed to delete existing complaints: ${deleteError.message}`);

      // Send delete failure update
      res.write(JSON.stringify({
        ...response,
        deleteOperation: response.deleteOperation
      }) + '\n');

      // Continue with upload even if delete fails (optional - you can make this stricter)
      response.warnings.push('Proceeding with upload despite delete failure');
    }

    const processedComplaintIds = new Set();
    let currentRow = 0;

    // Process data in parallel batches - NOW ONLY CREATING NEW RECORDS
    const processBatch = async (batch, batchIndex) => {
      const batchResults = [];
      const validRecords = [];
      let batchCreated = 0;
      let batchFailed = 0;
      let batchSkipped = 0;

      // Process each record in the batch
      for (const record of batch) {
        currentRow++;
        const recordResult = {
          row: currentRow,
          notification_complaintid: '',
          materialdescription: '',
          status: 'Processing',
          action: '',
          error: null,
          warnings: []
        };

        try {
          const { cleanedRecord, errors, providedFields } = validateRecord(record, headerMapping);
          recordResult.notification_complaintid = cleanedRecord.notification_complaintid || 'Unknown';
          recordResult.materialdescription = cleanedRecord.materialdescription || 'N/A';

          if (errors.length > 0) {
            recordResult.status = 'Failed';
            recordResult.error = errors.join(', ');
            recordResult.action = 'Validation failed';
            batchResults.push(recordResult);
            batchFailed++;
            continue;
          }

          // Check for duplicates within the file
          if (processedComplaintIds.has(cleanedRecord.notification_complaintid)) {
            recordResult.status = 'Skipped';
            recordResult.error = 'Duplicate Notification/Complaint ID in file';
            recordResult.action = 'Skipped due to file duplicate';
            recordResult.warnings.push('Notification/Complaint ID already processed in this file');
            batchResults.push(recordResult);
            batchSkipped++;
            continue;
          }

          processedComplaintIds.add(cleanedRecord.notification_complaintid);
          validRecords.push({ cleanedRecord, recordResult, providedFields });

        } catch (err) {
          recordResult.status = 'Failed';
          recordResult.action = 'Validation error';
          recordResult.error = err.message;
          batchResults.push(recordResult);
          batchFailed++;
        }
      }

      // Process valid records in bulk - ONLY INSERT OPERATIONS NOW
      if (validRecords.length > 0) {
        const bulkOps = [];
        const now = new Date();

        for (const { cleanedRecord, recordResult } of validRecords) {
          // Since we deleted all records, we only need to insert new ones
          bulkOps.push({
            insertOne: {
              document: {
                ...cleanedRecord,
                createdAt: now,
                modifiedAt: now
              }
            }
          });

          recordResult.status = 'Created';
          recordResult.action = 'Created new record';
          recordResult.changeDetails = [];
          recordResult.changesText = 'New record created after full delete';

          batchCreated++;
          batchResults.push(recordResult);
        }

        // Execute bulk insert operations
        if (bulkOps.length > 0) {
          try {
            await PendingComplaints.bulkWrite(bulkOps, { ordered: false });
            console.log(`Successfully inserted ${bulkOps.length} records in batch ${batchIndex + 1}`);
          } catch (bulkError) {
            console.error('Bulk insert error:', bulkError);
            // Handle bulk errors by marking affected records as failed
            if (bulkError.writeErrors) {
              bulkError.writeErrors.forEach(error => {
                const failedRecord = batchResults.find(r =>
                  r.notification_complaintid === error.op?.document?.notification_complaintid
                );
                if (failedRecord) {
                  failedRecord.status = 'Failed';
                  failedRecord.action = 'Bulk insert failed';
                  failedRecord.error = error.errmsg;
                  batchFailed++;
                  batchCreated--;
                }
              });
            } else {
              // If no specific write errors, mark all as failed
              batchResults.forEach(result => {
                if (result.status === 'Created') {
                  result.status = 'Failed';
                  result.action = 'Bulk insert failed';
                  result.error = bulkError.message;
                  batchFailed++;
                  batchCreated--;
                }
              });
            }
          }
        }
      }

      return {
        batchResults,
        batchCreated,
        batchUpdated: 0, // No updates in full delete mode
        batchFailed,
        batchSkipped
      };
    };

    // Process batches in parallel with controlled concurrency
    const batchPromises = [];
    for (let batchIndex = 0; batchIndex < response.batchProgress.totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, jsonData.length);
      const batch = jsonData.slice(startIdx, endIdx);

      response.batchProgress.currentBatch = batchIndex + 1;
      response.batchProgress.currentBatchRecords = batch.length;

      // Send progress update
      res.write(JSON.stringify({
        ...response,
        batchProgress: response.batchProgress
      }) + '\n');

      // Process batch with controlled parallelism
      if (batchPromises.length >= PARALLEL_BATCHES) {
        const completedBatch = await Promise.race(batchPromises);
        batchPromises.splice(batchPromises.indexOf(completedBatch), 1);

        // Update response with completed batch results
        response.processedRecords += completedBatch.batchResults.length;
        response.successfulRecords += completedBatch.batchCreated;
        response.failedRecords += completedBatch.batchFailed;
        response.summary.created += completedBatch.batchCreated;
        response.summary.failed += completedBatch.batchFailed;
        response.summary.skippedTotal += completedBatch.batchSkipped;
        response.summary.duplicatesInFile += completedBatch.batchResults.filter(
          r => r.status === 'Skipped' && r.error === 'Duplicate Notification/Complaint ID in file'
        ).length;
        response.results.push(...completedBatch.batchResults);

        res.write(JSON.stringify({
          ...response,
          batchCompleted: true,
          batchSummary: {
            created: completedBatch.batchCreated,
            updated: 0,
            failed: completedBatch.batchFailed,
            skipped: completedBatch.batchSkipped
          },
          batchProgress: response.batchProgress,
          latestRecords: completedBatch.batchResults.slice(-3)
        }) + '\n');
      }

      batchPromises.push(processBatch(batch, batchIndex));
    }

    // Process remaining batches
    while (batchPromises.length > 0) {
      const completedBatch = await batchPromises.shift();

      // Update response with completed batch results
      response.processedRecords += completedBatch.batchResults.length;
      response.successfulRecords += completedBatch.batchCreated;
      response.failedRecords += completedBatch.batchFailed;
      response.summary.created += completedBatch.batchCreated;
      response.summary.failed += completedBatch.batchFailed;
      response.summary.skippedTotal += completedBatch.batchSkipped;
      response.summary.duplicatesInFile += completedBatch.batchResults.filter(
        r => r.status === 'Skipped' && r.error === 'Duplicate Notification/Complaint ID in file'
      ).length;
      response.results.push(...completedBatch.batchResults);

      res.write(JSON.stringify({
        ...response,
        batchCompleted: true,
        batchSummary: {
          created: completedBatch.batchCreated,
          updated: 0,
          failed: completedBatch.batchFailed,
          skipped: completedBatch.batchSkipped
        },
        batchProgress: response.batchProgress,
        latestRecords: completedBatch.batchResults.slice(-3)
      }) + '\n');
    }

    // Finalize response
    response.status = 'completed';
    response.endTime = new Date();
    response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;

    response.message = `Full delete & upload completed successfully. ` +
      `Deleted: ${response.summary.deleted}, ` +
      `Created: ${response.summary.created}, ` +
      `Failed: ${response.summary.failed}, ` +
      `File Duplicates: ${response.summary.duplicatesInFile}, ` +
      `Total Skipped: ${response.summary.skippedTotal}`;

    res.write(JSON.stringify(response) + '\n');
    res.end();

  } catch (error) {
    console.error('Pending complaints bulk upload error:', error);
    response.status = 'failed';
    response.endTime = new Date();
    response.errors.push(`System error: ${error.message}`);
    response.duration = response.endTime ? `${((response.endTime - response.startTime) / 1000).toFixed(2)}s` : '0s';

    if (!res.headersSent) {
      return res.status(500).json(response);
    } else {
      res.write(JSON.stringify(response) + '\n');
      res.end();
    }
  }
});

module.exports = router;
