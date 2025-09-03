const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const CheckList = require('../../Model/CollectionSchema/ChecklistSchema');

// Optimized: Pre-compiled regex patterns
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]/g;
const MULTISPACE_REGEX = /\s+/g;

// Memory storage with optimized settings
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const fileName = file.originalname.toLowerCase();
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ];

    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    const hasValidMimeType = allowedMimeTypes.includes(file.mimetype);

    if (hasValidExtension || hasValidMimeType) {
      cb(null, true);
    } else {
      cb(new Error(
        `Invalid file type. Only ${allowedExtensions.join(', ')} formats are allowed. ` +
        `Received: ${file.mimetype} (${fileName})`
      ), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// **FIXED:** Field mappings to match exact schema field names
const FIELD_MAPPINGS = {
  'checklisttype': new Set([
    'checklisttype', 'checklist_type', 'checklist-type',
    'type', 'checklistcategory', 'checklist_category',
    'listtype', 'list_type'
  ]),
  'status': new Set([
    'status', 'record_status', 'checklist_status',
    'current_status', 'active_status', 'state', 'condition'
  ]),
  'checkpointtype': new Set([
    'checkpointtype', 'checkpoint_type', 'checkpoint-type',
    'checktype', 'check_type', 'pointtype', 'point_type',
    'checkpointcategory', 'checkpoint_category'
  ]),
  'checkpoint': new Set([
    'checkpoint', 'check_point', 'check-point',
    'checkpointname', 'checkpoint_name', 'checkpoint-name',
    'point', 'checkname', 'check_name'
  ]),
  // **FIXED:** Change to prodGroup to match schema
  'prodGroup': new Set([
    'prodgroup', 'prod_group', 'prod-group',
    'productgroup', 'product_group', 'product-group',
    'group', 'category', 'productcategory'
  ]),
  'result': new Set([
    'result', 'outcome', 'output', 'finding',
    'conclusion', 'answer', 'response'
  ]),
  'resulttype': new Set([
    'resulttype', 'result_type', 'result-type',
    'outcometype', 'outcome_type', 'resultcategory',
    'result_category', 'outputtype', 'output_type'
  ]),
  // **FIXED:** Change to startVoltage and endVoltage to match schema
  'startVoltage': new Set([
    'startvoltage', 'start_voltage', 'start-voltage',
    'initialvoltage', 'initial_voltage', 'beginvoltage',
    'begin_voltage', 'fromvoltage', 'from_voltage'
  ]),
  'endVoltage': new Set([
    'endvoltage', 'end_voltage', 'end-voltage',
    'finalvoltage', 'final_voltage', 'tovoltage',
    'to_voltage', 'lastvoltage', 'last_voltage'
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

    if (seenFields.has(normalizedHeader)) continue;
    seenFields.add(normalizedHeader);

    for (const [schemaField, variations] of Object.entries(FIELD_MAPPINGS)) {
      if (variations.has(normalizedHeader)) {
        mappedHeaders[header] = schemaField;
        break;
      }
    }
  }

  return mappedHeaders;
}

// Optimized Excel parsing
function parseExcelFile(buffer) {
  try {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      codepage: 65001
    });
    const sheetName = workbook.SheetNames[0];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: '',
      raw: false
    });
  } catch (error) {
    throw new Error(`Excel parsing error: ${error.message}`);
  }
}

// Optimized CSV parsing
function parseCSVFile(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString())
      .pipe(csv({
        mapValues: ({ value }) => value.trim(),
        strict: true,
        skipLines: 0,
        skipEmptyLines: true
      }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);

    stream.on('error', () => stream.destroy());
  });
}

// Helper function to determine file type
function getFileType(fileName, mimeType) {
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.endsWith('.csv')) {
    return 'csv';
  } else if (lowerFileName.endsWith('.xlsx')) {
    return 'xlsx';
  } else if (lowerFileName.endsWith('.xls')) {
    return 'xls';
  }

  switch (mimeType) {
    case 'text/csv':
    case 'application/csv':
      return 'csv';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'xlsx';
    case 'application/vnd.ms-excel':
      return 'xls';
    default:
      return 'unknown';
  }
}

// Function to check for changes between existing and new records
function checkForChanges(existingRecord, newRecord, providedFields) {
  const changes = [];
  let hasChanges = false;

  for (const field of providedFields) {
    const oldValue = existingRecord[field] || '';
    const newValue = newRecord[field] || '';

    if (oldValue !== newValue) {
      hasChanges = true;
      changes.push({
        field,
        oldValue,
        newValue
      });
    }
  }

  return {
    hasChanges,
    changeDetails: changes
  };
}

// **FIXED:** Generate comprehensive unique identifier for proper duplicate detection
function generateUniqueKey(record) {
  // Use all 4 fields for comprehensive duplicate detection
  return `${(record.checkpoint || '').toLowerCase()}_${(record.checkpointtype || '').toLowerCase()}_${(record.checklisttype || '').toLowerCase()}_${(record.prodGroup || '').toLowerCase()}`;
}

// Record validation to match CheckList schema requirements
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

  // **FIXED:** Updated required fields to match schema exactly
  const requiredFields = ['checklisttype', 'status', 'checkpointtype', 'checkpoint', 'prodGroup', 'resulttype'];
  for (const field of requiredFields) {
    if (!cleanedRecord[field]) {
      errors.push(`${field} is required`);
    }
  }

  // Early exit if required fields are missing
  if (errors.length > 0) {
    return { cleanedRecord, errors, providedFields };
  }

  // Length validation
  const fieldLimits = {
    'checklisttype': 200,
    'status': 50,
    'checkpointtype': 200,
    'checkpoint': 500,
    'prodGroup': 200,
    'result': 1000,
    'resulttype': 200,
    'startVoltage': 50,
    'endVoltage': 50
  };

  for (const [field, maxLength] of Object.entries(fieldLimits)) {
    if (cleanedRecord[field] && cleanedRecord[field].length > maxLength) {
      errors.push(`${field} too long (max ${maxLength} characters)`);
    }
  }

  // **FIXED:** Set timestamps properly
  const now = new Date();
  cleanedRecord.createdAt = now;
  cleanedRecord.modifiedAt = now;

  return { cleanedRecord, errors, providedFields };
}

// MAIN ROUTE - CheckList Bulk Upload
router.post('/checklist-bulk-upload', upload.single('file'), async (req, res) => {
  const BATCH_SIZE = 500; // **REDUCED:** For better error handling
  const PARALLEL_BATCHES = 2; // **REDUCED:** For stability
  const BULK_WRITE_BATCH_SIZE = 200; // **REDUCED:** For better control

  // Initialize response object
  const response = {
    status: 'processing',
    startTime: new Date(),
    totalRecords: 0,
    processedRecords: 0,
    successfulRecords: 0,
    failedRecords: 0,
    results: [],
    summary: {
      created: 0,
      updated: 0,
      failed: 0,
      duplicatesInFile: 0,
      existingRecords: 0,
      skippedTotal: 0,
      noChangesSkipped: 0
    },
    headerMapping: {},
    errors: [],
    warnings: [],
    batchProgress: {
      currentBatch: 0,
      totalBatches: 0,
      batchSize: BATCH_SIZE,
      currentBatchRecords: 0
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

    // Determine file type and parse accordingly
    const fileType = getFileType(req.file.originalname, req.file.mimetype);
    let jsonData;

    try {
      if (fileType === 'csv') {
        jsonData = await parseCSVFile(req.file.buffer);
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        jsonData = parseExcelFile(req.file.buffer);
      } else {
        throw new Error(`Unsupported file format. File: ${req.file.originalname}, MIME: ${req.file.mimetype}`);
      }
    } catch (parseError) {
      response.status = 'failed';
      response.errors.push(`File parsing error: ${parseError.message}`);
      return res.status(400).json(response);
    }

    if (!jsonData || jsonData.length === 0) {
      response.status = 'failed';
      response.errors.push('No data found in file');
      return res.status(400).json(response);
    }

    response.totalRecords = jsonData.length;
    response.batchProgress.totalBatches = Math.ceil(jsonData.length / BATCH_SIZE);

    // Map headers
    const headers = Object.keys(jsonData[0] || {});
    const headerMapping = mapHeaders(headers);
    response.headerMapping = headerMapping;

    // **FIXED:** Check for required fields with correct field names
    const requiredFields = ['checklisttype', 'status', 'checkpointtype', 'checkpoint', 'prodGroup', 'resulttype'];
    const hasRequiredFields = requiredFields.every(field =>
      Object.values(headerMapping).includes(field)
    );

    if (!hasRequiredFields) {
      const missingFields = requiredFields.filter(field =>
        !Object.values(headerMapping).includes(field)
      );
      response.status = 'failed';
      response.errors.push(
        `Required headers not found: ${missingFields.join(', ')}. Available headers: ${headers.join(', ')}`
      );
      return res.status(400).json(response);
    }

    // Send initial response
    res.write(JSON.stringify(response) + '\n');

    const processedUniqueKeys = new Set();
    let currentRow = 0;

    // Process data in batches
    const processBatch = async (batch, batchIndex) => {
      const batchResults = [];
      const validRecords = [];
      let batchCreated = 0;
      let batchUpdated = 0;
      let batchFailed = 0;
      let batchSkipped = 0;

      // Process each record in the batch
      for (const record of batch) {
        currentRow++;
        const recordResult = {
          row: currentRow,
          checkpoint: '',
          checklisttype: '',
          prodgroup: '',
          status: 'Processing',
          action: '',
          error: null,
          warnings: []
        };

        try {
          const { cleanedRecord, errors, providedFields } = validateRecord(record, headerMapping);

          recordResult.checkpoint = cleanedRecord.checkpoint || 'Unknown';
          recordResult.checklisttype = cleanedRecord.checklisttype || 'Unknown';
          recordResult.prodgroup = cleanedRecord.prodGroup || 'Unknown';

          if (errors.length > 0) {
            recordResult.status = 'Failed';
            recordResult.error = errors.join(', ');
            recordResult.action = 'Validation failed';
            batchResults.push(recordResult);
            batchFailed++;
            continue;
          }

          // **FIXED:** Generate comprehensive unique key for duplicate checking
          const uniqueKey = generateUniqueKey(cleanedRecord);

          // **ENHANCED:** Check for duplicates within the file
          if (processedUniqueKeys.has(uniqueKey)) {
            recordResult.status = 'Skipped';
            recordResult.error = 'Duplicate combination of checkpoint + checkpointtype + checklisttype + prodGroup in file';
            recordResult.action = 'Skipped due to file duplicate';
            recordResult.warnings.push('Duplicate combination already processed in this file');
            batchResults.push(recordResult);
            batchSkipped++;
            response.summary.duplicatesInFile++;
            continue;
          }

          processedUniqueKeys.add(uniqueKey);
          validRecords.push({ cleanedRecord, recordResult, providedFields, uniqueKey });

        } catch (err) {
          recordResult.status = 'Failed';
          recordResult.action = 'Validation error';
          recordResult.error = err.message;
          batchResults.push(recordResult);
          batchFailed++;
        }
      }

      // Process valid records in bulk
      if (validRecords.length > 0) {
        // **ENHANCED:** Find existing records using comprehensive matching
        const existingRecords = await CheckList.find({
          $or: validRecords.map(r => ({
            checkpoint: r.cleanedRecord.checkpoint,
            checkpointtype: r.cleanedRecord.checkpointtype,
            checklisttype: r.cleanedRecord.checklisttype,
            prodGroup: r.cleanedRecord.prodGroup
          }))
        }).lean();

        console.log(`Found ${existingRecords.length} existing records in database`);

        const existingRecordsMap = new Map();
        existingRecords.forEach(rec => {
          const key = generateUniqueKey(rec);
          existingRecordsMap.set(key, rec);
        });

        // Prepare bulk operations
        const bulkCreateOps = [];
        const bulkUpdateOps = [];
        const now = new Date();

        for (const { cleanedRecord, recordResult, providedFields, uniqueKey } of validRecords) {
          const existingRecord = existingRecordsMap.get(uniqueKey);

          if (existingRecord) {
            response.summary.existingRecords++;

            const comparisonResult = checkForChanges(existingRecord, cleanedRecord, providedFields);

            if (comparisonResult.hasChanges) {
              const updateData = {
                ...cleanedRecord,
                modifiedAt: now
              };

              bulkUpdateOps.push({
                updateOne: {
                  filter: { _id: existingRecord._id },
                  update: { $set: updateData }
                }
              });

              const changesList = comparisonResult.changeDetails.map(change =>
                `${change.field}: "${change.oldValue}" → "${change.newValue}"`
              ).join(', ');

              recordResult.status = 'Updated';
              recordResult.action = 'Updated existing record';
              recordResult.warnings.push(`Changes: ${changesList}`);
              batchUpdated++;
            } else {
              recordResult.status = 'Skipped';
              recordResult.action = 'No changes detected - record already exists with same data';
              recordResult.warnings.push('Identical record already exists in database');
              batchSkipped++;
              response.summary.noChangesSkipped++;
            }
          } else {
            // **FIXED:** Ensure all required fields are present before creating
            bulkCreateOps.push({
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
            batchCreated++;
          }

          batchResults.push(recordResult);
        }

        // **ENHANCED:** Execute bulk operations with better error handling
        const executeBulkWrite = async (operations, operationType) => {
          let totalSuccess = 0;
          let totalErrors = 0;

          for (let i = 0; i < operations.length; i += BULK_WRITE_BATCH_SIZE) {
            const chunk = operations.slice(i, i + BULK_WRITE_BATCH_SIZE);
            try {
              const result = await CheckList.bulkWrite(chunk, { 
                ordered: false, 
                setDefaultsOnInsert: true 
              });
              
              console.log(`${operationType} BulkWrite Result (Chunk ${Math.floor(i/BULK_WRITE_BATCH_SIZE) + 1}):`, {
                insertedCount: result.insertedCount,
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
                upsertedCount: result.upsertedCount,
                writeErrors: result.writeErrors ? result.writeErrors.length : 0
              });

              totalSuccess += (result.insertedCount || 0) + (result.modifiedCount || 0);

              // Handle individual write errors
              if (result.writeErrors && result.writeErrors.length > 0) {
                result.writeErrors.forEach(error => {
                  console.error(`${operationType} Write Error:`, error.errmsg);
                  totalErrors++;
                  
                  // Find the corresponding result record and mark it as failed
                  const failedDoc = error.op?.insertOne?.document || error.op?.updateOne?.update?.$set;
                  if (failedDoc) {
                    const failedResult = batchResults.find(r => 
                      r.checkpoint === failedDoc.checkpoint && 
                      r.checklisttype === failedDoc.checklisttype
                    );
                    if (failedResult) {
                      const previousStatus = failedResult.status;
                      failedResult.status = 'Failed';
                      failedResult.action = 'Database operation failed';
                      failedResult.error = error.errmsg;
                      
                      // Adjust counters
                      if (previousStatus === 'Created') batchCreated--;
                      if (previousStatus === 'Updated') batchUpdated--;
                      batchFailed++;
                    }
                  }
                });
              }
            } catch (bulkError) {
              console.error(`${operationType} BulkWrite Error:`, bulkError.message);
              totalErrors++;
              
              // Mark all records in this chunk as failed
              const startIdx = i;
              const endIdx = Math.min(i + BULK_WRITE_BATCH_SIZE, operations.length);
              for (let j = startIdx; j < endIdx; j++) {
                const op = operations[j];
                const doc = op.insertOne?.document || op.updateOne?.update?.$set;
                if (doc) {
                  const failedResult = batchResults.find(r => 
                    r.checkpoint === doc.checkpoint && 
                    r.checklisttype === doc.checklisttype
                  );
                  if (failedResult && failedResult.status !== 'Failed') {
                    const previousStatus = failedResult.status;
                    failedResult.status = 'Failed';
                    failedResult.action = 'Bulk operation failed';
                    failedResult.error = bulkError.message;
                    
                    // Adjust counters
                    if (previousStatus === 'Created') batchCreated--;
                    if (previousStatus === 'Updated') batchUpdated--;
                    batchFailed++;
                  }
                }
              }
            }
          }

          console.log(`${operationType} Summary: Success=${totalSuccess}, Errors=${totalErrors}`);
          return { totalSuccess, totalErrors };
        };

        // Execute create and update operations
        const results = await Promise.all([
          bulkCreateOps.length > 0 ? executeBulkWrite(bulkCreateOps, 'CREATE') : Promise.resolve({ totalSuccess: 0, totalErrors: 0 }),
          bulkUpdateOps.length > 0 ? executeBulkWrite(bulkUpdateOps, 'UPDATE') : Promise.resolve({ totalSuccess: 0, totalErrors: 0 })
        ]);

        const [createResults, updateResults] = results;
        console.log(`Batch ${batchIndex + 1} Summary:`, {
          created: batchCreated,
          updated: batchUpdated,
          failed: batchFailed,
          skipped: batchSkipped,
          createSuccess: createResults.totalSuccess,
          updateSuccess: updateResults.totalSuccess
        });
      }

      return {
        batchResults,
        batchCreated,
        batchUpdated,
        batchFailed,
        batchSkipped
      };
    };

    // Process batches sequentially for better error handling and logging
    for (let batchIndex = 0; batchIndex < response.batchProgress.totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, jsonData.length);
      const batch = jsonData.slice(startIdx, endIdx);

      response.batchProgress.currentBatch = batchIndex + 1;
      response.batchProgress.currentBatchRecords = batch.length;

      console.log(`Processing batch ${batchIndex + 1}/${response.batchProgress.totalBatches} (${batch.length} records)`);

      const completedBatch = await processBatch(batch, batchIndex);

      response.processedRecords += completedBatch.batchResults.length;
      response.successfulRecords += completedBatch.batchCreated + completedBatch.batchUpdated;
      response.failedRecords += completedBatch.batchFailed;
      response.summary.created += completedBatch.batchCreated;
      response.summary.updated += completedBatch.batchUpdated;
      response.summary.failed += completedBatch.batchFailed;
      response.summary.skippedTotal += completedBatch.batchSkipped;
      response.results.push(...completedBatch.batchResults);

      // Send progress update
      res.write(JSON.stringify({
        ...response,
        batchCompleted: true,
        batchSummary: {
          created: completedBatch.batchCreated,
          updated: completedBatch.batchUpdated,
          failed: completedBatch.batchFailed,
          skipped: completedBatch.batchSkipped
        },
        batchProgress: response.batchProgress
      }) + '\n');
    }

    // **ADDED:** Final verification - check if data was actually saved
    const finalCount = await CheckList.countDocuments();
    console.log(`Final verification: Total CheckList records in database: ${finalCount}`);

    // Finalize response
    response.status = 'completed';
    response.endTime = new Date();
    response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;

    response.message = `Processing completed successfully. ` +
      `Created: ${response.summary.created}, ` +
      `Updated: ${response.summary.updated}, ` +
      `Failed: ${response.summary.failed}, ` +
      `File Duplicates: ${response.summary.duplicatesInFile}, ` +
      `Existing Records: ${response.summary.existingRecords}, ` +
      `No Changes Skipped: ${response.summary.noChangesSkipped}, ` +
      `Total Skipped: ${response.summary.skippedTotal}`;

    res.write(JSON.stringify(response) + '\n');
    res.end();

  } catch (error) {
    console.error('CheckList bulk upload error:', error);
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
