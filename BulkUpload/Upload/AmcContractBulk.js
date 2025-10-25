const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { parse, isValid } = require('date-fns');
const AMCContract = require('../../Model/UploadSchema/AMCContractSchema');

// Optimized: Pre-compiled regex patterns
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]/g;
const MULTISPACE_REGEX = /\s+/g;

// Memory storage with optimized settings
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const fileName = file.originalname.toLowerCase();
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
        const isCSV = fileName.endsWith('.csv');
        const validMimeTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv', // .csv
            'application/csv'
        ];

        if (isExcel || isCSV || validMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'), false);
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Optimized: Predefined field mappings for faster access - ADDED STATUS FIELD
// FIXED: Updated field mappings with normalized versions
const FIELD_MAPPINGS = {
    'salesdoc': new Set(['salesdoc', 'sales_doc', 'salesdocument', 'sales_document', 'document', 'docno', 'doc_no', 'salesdoc']), // Added normalized version
    'startdate': new Set(['startdate', 'start_date', 'begin_date', 'begindate', 'fromdate', 'from_date', 'startdt']), // Added normalized version
    'enddate': new Set(['enddate', 'end_date', 'finish_date', 'finishdate', 'todate', 'to_date', 'expiry_date', 'expirydate', 'enddate']), // Added normalized version  
    'satypeZDRC_ZDRN': new Set(['satype', 'sa_type', 'satypezdrc_zdrn', 'satype_zdrc_zdrn', 'type', 'satypezdrczdrn', 'saty']), // Changed 'SaTy' to 'saty'
    'serialnumber': new Set(['serialnumber', 'serial_number', 'serialno', 'serial_no', 'sno', 'serialnumber']), // Added normalized version
    'materialcode': new Set(['materialcode', 'material_code', 'partno', 'part_no', 'code', 'item_code', 'product_code', 'material']),
    'status': new Set(['status', 'record_status', 'contract_status', 'amc_status', 'current_status', 'state'])
};

// Helper function to get file extension
function getFileExtension(filename) {
    return filename.toLowerCase().split('.').pop();
}

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

// Optimized date parsing with cache and consistent date normalization
const dateCache = new Map();
function parseUniversalDate(dateInput) {
    if (!dateInput) return null;

    // Handle ### (Excel error) or invalid dates
    if (typeof dateInput === 'string' && (dateInput.includes('#') || dateInput.trim() === '')) {
        return null;
    }

    const cacheKey = JSON.stringify(dateInput);
    if (dateCache.has(cacheKey)) return dateCache.get(cacheKey);

    let result = null;

    if (dateInput instanceof Date && !isNaN(dateInput)) {
        // Normalize to date only (remove time component)
        const date = new Date(dateInput);
        result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    } else if (typeof dateInput === 'number') {
        try {
            const excelDate = XLSX.SSF.parse_date_code(dateInput);
            result = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
        } catch (e) {
            result = null;
        }
    } else {
        const formats = [
            'dd/MM/yyyy', 'dd-MM-yyyy', 'dd.MM.yyyy',
            'MM/dd/yyyy', 'MM-dd-yyyy', 'MM.dd.yyyy',
            'yyyy/MM/dd', 'yyyy-MM-dd', 'yyyy.MM.dd',
            'd/M/yyyy', 'd-M-yyyy', 'd.M.yyyy',
            'M/d/yyyy', 'M-d-yyyy', 'M.d.yyyy',
            'dd/MM/yy', 'dd-MM-yy', 'dd.MM.yy'
        ];

        for (const format of formats) {
            try {
                const parsedDate = parse(dateInput.toString(), format, new Date());
                if (isValid(parsedDate)) {
                    // Normalize to date only (remove time component)
                    result = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
                    break;
                }
            } catch (e) {
                continue;
            }
        }
    }

    dateCache.set(cacheKey, result);
    return result;
}

// Optimized Excel parsing with buffer reuse
function parseExcelFile(buffer) {
    try {
        const workbook = XLSX.read(buffer, {
            type: 'buffer',
            cellDates: true,
            codepage: 65001 // UTF-8
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

// Optimized CSV parsing with stream control
function parseCSVFile(buffer) {
    return new Promise((resolve, reject) => {
        const results = [];
        const stream = Readable.from(buffer.toString())
            .pipe(csv({
                mapValues: ({ value }) => value.trim(),
                strict: false, // Changed from true to handle more CSV variations
                skipLines: 0,
                skipEmptyLines: true
            }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);

        stream.on('error', () => stream.destroy());
    });
}

// Create composite key for record identification
function createCompositeKey(record) {
    // Using all fields to create unique identifier since no field is unique
    const keyParts = [
        record.salesdoc || '',
        record.serialnumber || '',
        record.materialcode || '',
        record.satypeZDRC_ZDRN || ''
    ];

    // Add date parts if available
    if (record.startdate) {
        keyParts.push(record.startdate.toISOString().split('T')[0]); // YYYY-MM-DD format
    }
    if (record.enddate) {
        keyParts.push(record.enddate.toISOString().split('T')[0]); // YYYY-MM-DD format
    }

    return keyParts.join('|').toLowerCase();
}

// Optimized record validation with early exits - UPDATED WITH STATUS HANDLING
function validateRecord(record, headerMapping) {
    const cleanedRecord = {};
    const providedFields = [];
    const errors = [];

    // Map headers to schema fields
    for (const [originalHeader, schemaField] of Object.entries(headerMapping)) {
        if (record[originalHeader] === undefined || record[originalHeader] === null) continue;

        const value = String(record[originalHeader]).trim();
        if (value === '' || value === 'undefined' || value === 'null') continue;

        // Special handling for dates
        if (['startdate', 'enddate'].includes(schemaField)) {
            const parsedDate = parseUniversalDate(record[originalHeader]);
            if (parsedDate) {
                cleanedRecord[schemaField] = parsedDate;
                providedFields.push(schemaField);
            } else if (value.includes('#')) {
                // Skip records with invalid dates (like ########)
                errors.push(`Invalid ${schemaField}: ${value}`);
            }
        } else {
            cleanedRecord[schemaField] = value.replace(MULTISPACE_REGEX, ' ').trim();
            providedFields.push(schemaField);
        }
    }

    // Required field validation
    if (!cleanedRecord.salesdoc) {
        errors.push('Sales Doc is required');
    }
    if (!cleanedRecord.serialnumber) {
        errors.push('Serial Number is required');
    }
    if (!cleanedRecord.satypeZDRC_ZDRN) {
        errors.push('SA Type is required');
    }
    if (!cleanedRecord.materialcode) {
        errors.push('Material Code is required');
    }

    // Early exit if required fields are missing
    if (errors.length > 0) {
        return { cleanedRecord, errors, providedFields };
    }

    // Length validation
    if (cleanedRecord.salesdoc && cleanedRecord.salesdoc.length > 50) {
        errors.push('Sales Doc too long (max 50 characters)');
    }
    if (cleanedRecord.serialnumber && cleanedRecord.serialnumber.length > 50) {
        errors.push('Serial Number too long (max 50 characters)');
    }
    if (cleanedRecord.materialcode && cleanedRecord.materialcode.length > 50) {
        errors.push('Material Code too long (max 50 characters)');
    }

    // Date validation
    if (cleanedRecord.startdate && cleanedRecord.enddate && cleanedRecord.startdate > cleanedRecord.enddate) {
        errors.push('Start Date cannot be later than End Date');
    }

    // Set default status only if not provided in file
    if (!cleanedRecord.status || cleanedRecord.status.trim() === '') {
        cleanedRecord.status = 'Active';
    }

    return { cleanedRecord, errors, providedFields };
}

// Enhanced comparison function for all fields - UPDATED WITH STATUS FIELD
function checkForChanges(existingRecord, newRecord, providedFields) {
    let hasAnyChange = false;
    const changeDetails = [];

    for (const field of providedFields) {
        let isEqual = false;
        let existingValue, newValue;

        if (['startdate', 'enddate'].includes(field)) {
            // Date comparison with proper handling
            const existingDate = existingRecord[field] ? new Date(existingRecord[field]) : null;
            const newDate = newRecord[field] ? new Date(newRecord[field]) : null;

            if (existingDate && newDate) {
                // Compare only date part (ignore time differences)
                const existingDateStr = existingDate.toDateString();
                const newDateStr = newDate.toDateString();
                isEqual = existingDateStr === newDateStr;

                existingValue = existingDate.toLocaleDateString('en-GB'); // DD/MM/YYYY format
                newValue = newDate.toLocaleDateString('en-GB'); // DD/MM/YYYY format
            } else {
                isEqual = (!existingDate && !newDate); // Both are null/undefined
                existingValue = existingDate ? existingDate.toLocaleDateString('en-GB') : '';
                newValue = newDate ? newDate.toLocaleDateString('en-GB') : '';
            }
        } else {
            // String comparison for non-date fields (including status)
            existingValue = existingRecord[field] ? String(existingRecord[field]).trim() : '';
            newValue = newRecord[field] ? String(newRecord[field]).trim() : '';
            isEqual = existingValue === newValue;
        }

        if (!isEqual) {
            hasAnyChange = true;
            changeDetails.push({
                field,
                oldValue: existingValue,
                newValue
            });
        }
    }

    return { hasChanges: hasAnyChange, changeDetails };
}

// MAIN ROUTE - Complete implementation with status handling
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
    const BATCH_SIZE = 2000; // Reduced for better memory management
    const PARALLEL_BATCHES = 3; // Reduced for stability
    const BULK_WRITE_BATCH_SIZE = 500; // MongoDB bulk write batch size

    // Initialize response object - UPDATED WITH STATUS TRACKING
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
            noChangesSkipped: 0,
            invalidDates: 0,
            statusUpdates: {
                total: 0,
                byStatus: {}
            }
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

        // Parse file with optimized method selection - FIXED FILE EXTENSION LOGIC
        let jsonData;
        const fileName = req.file.originalname.toLowerCase();
        const fileExtension = getFileExtension(fileName);

        console.log(`Processing file: ${fileName}, Extension: ${fileExtension}`);

        try {
            if (fileExtension === 'csv') {
                jsonData = await parseCSVFile(req.file.buffer);
            } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                jsonData = parseExcelFile(req.file.buffer);
            } else {
                throw new Error(`Unsupported file format: ${fileExtension}. Only CSV, XLS, and XLSX files are supported.`);
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

        // Map headers with optimized method
        const headers = Object.keys(jsonData[0] || {});
        const headerMapping = mapHeaders(headers);
        response.headerMapping = headerMapping;

        console.log('Available headers:', headers);
        console.log('Mapped headers:', headerMapping);

        // Check for required fields with optimized lookup - status is NOT required
        const requiredSchemaFields = ['salesdoc', 'serialnumber', 'satypeZDRC_ZDRN', 'materialcode'];
        const mappedSchemaFields = Object.values(headerMapping);
        const missingFields = requiredSchemaFields.filter(field => !mappedSchemaFields.includes(field));

        if (missingFields.length > 0) {
            response.status = 'failed';
            response.errors.push(
                `Required fields not found: ${missingFields.join(', ')}. Available mapped fields: ${mappedSchemaFields.join(', ')}`
            );
            return res.status(400).json(response);
        }

        // Check if status field is available
        const hasStatusField = mappedSchemaFields.includes('status');
        if (hasStatusField) {
            response.warnings.push('Status field detected in file and will be processed');
        } else {
            response.warnings.push('Status field not found in file. Default status "Active" will be assigned to new records');
        }

        // Send initial response
        res.write(JSON.stringify(response) + '\n');

        const processedCompositeKeys = new Set(); // Track processed records in current file
        let currentRow = 0;

        // Process data in batches
        const processBatch = async (batch, batchIndex) => {
            const batchResults = [];
            const validRecords = [];
            let batchCreated = 0;
            let batchUpdated = 0;
            let batchFailed = 0;
            let batchSkippedDuplicates = 0;
            let batchSkippedNoChanges = 0;
            let batchInvalidDates = 0;

            // Process each record in the batch
            for (const record of batch) {
                currentRow++;
                const recordResult = {
                    row: currentRow,
                    salesdoc: '',
                    serialnumber: '',
                    status: 'Processing',
                    action: '',
                    error: null,
                    warnings: [],
                    assignedStatus: null, // Track assigned status
                    statusChanged: false // Track if status was changed
                };

                try {
                    const { cleanedRecord, errors, providedFields } = validateRecord(record, headerMapping);
                    recordResult.salesdoc = cleanedRecord.salesdoc || 'Unknown';
                    recordResult.serialnumber = cleanedRecord.serialnumber || 'Unknown';
                    recordResult.assignedStatus = cleanedRecord.status;

                    if (errors.length > 0) {
                        recordResult.status = 'Failed';
                        recordResult.error = errors.join(', ');
                        recordResult.action = 'Validation failed';
                        batchResults.push(recordResult);
                        batchFailed++;

                        // Check if it's due to invalid date
                        if (errors.some(err => err.includes('Invalid'))) {
                            batchInvalidDates++;
                        }
                        continue;
                    }

                    // Create composite key for this record
                    const compositeKey = createCompositeKey(cleanedRecord);

                    // Check for duplicates within the current file being processed
                    if (processedCompositeKeys.has(compositeKey)) {
                        recordResult.status = 'Skipped';
                        recordResult.error = 'Duplicate record in file (same combination of all fields)';
                        recordResult.action = 'Skipped due to file duplicate';
                        recordResult.warnings.push('Exact duplicate found in this file');
                        batchResults.push(recordResult);
                        batchSkippedDuplicates++;
                        continue;
                    }

                    processedCompositeKeys.add(compositeKey);
                    validRecords.push({ cleanedRecord, recordResult, providedFields, compositeKey });

                } catch (err) {
                    recordResult.status = 'Failed';
                    recordResult.action = 'Validation error';
                    recordResult.error = err.message;
                    batchResults.push(recordResult);
                    batchFailed++;
                }
            }

            // Process valid records
            if (validRecords.length > 0) {
                // Find existing records using multiple criteria for better matching
                const searchConditions = validRecords.map(r => ({
                    salesdoc: r.cleanedRecord.salesdoc,
                    serialnumber: r.cleanedRecord.serialnumber,
                    materialcode: r.cleanedRecord.materialcode,
                    satypeZDRC_ZDRN: r.cleanedRecord.satypeZDRC_ZDRN
                }));

                const existingRecords = await AMCContract.find({
                    $or: searchConditions
                }).lean();

                // Create map with composite key for existing records
                const existingRecordsMap = new Map();
                existingRecords.forEach(rec => {
                    const compositeKey = createCompositeKey(rec);
                    existingRecordsMap.set(compositeKey, rec);
                });

                // Prepare bulk operations
                const bulkCreateOps = [];
                const bulkUpdateOps = [];
                const now = new Date();

                for (const { cleanedRecord, recordResult, providedFields, compositeKey } of validRecords) {
                    const existingRecord = existingRecordsMap.get(compositeKey);

                    if (existingRecord) {
                        response.summary.existingRecords++;

                        // Handle status for existing records
                        const statusFromFile = providedFields.includes('status');
                        if (!statusFromFile) {
                            // Keep existing status if not provided in file
                            cleanedRecord.status = existingRecord.status;
                            recordResult.assignedStatus = existingRecord.status;
                        } else if (cleanedRecord.status !== existingRecord.status) {
                            recordResult.statusChanged = true;
                        }

                        const comparisonResult = checkForChanges(existingRecord, cleanedRecord, providedFields);

                        if (comparisonResult.hasChanges) {
                            const updateData = { modifiedAt: now };
                            providedFields.forEach(field => {
                                updateData[field] = cleanedRecord[field];
                            });

                            // Update status if provided in file
                            if (statusFromFile) {
                                updateData.status = cleanedRecord.status;
                            }

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
                            recordResult.changeDetails = comparisonResult.changeDetails;
                            recordResult.changesText = changesList;
                            recordResult.warnings.push(`Changes detected: ${changesList}`);

                            if (recordResult.statusChanged) {
                                recordResult.warnings.push(`Status changed: ${existingRecord.status} → ${cleanedRecord.status}`);
                            }

                            batchUpdated++;
                        } else {
                            recordResult.status = 'Skipped';
                            recordResult.action = 'No changes detected';
                            recordResult.changeDetails = [];
                            recordResult.changesText = 'No changes detected';
                            recordResult.warnings.push('Record already exists with identical data');

                            batchSkippedNoChanges++;
                        }
                    } else {
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
                        recordResult.changeDetails = [];
                        recordResult.changesText = 'New record created';

                        batchCreated++;
                    }

                    batchResults.push(recordResult);
                }

                // Execute bulk operations in smaller chunks
                const executeBulkWrite = async (operations, operationType) => {
                    for (let i = 0; i < operations.length; i += BULK_WRITE_BATCH_SIZE) {
                        const chunk = operations.slice(i, i + BULK_WRITE_BATCH_SIZE);
                        try {
                            await AMCContract.bulkWrite(chunk, { ordered: false });
                        } catch (bulkError) {
                            console.error(`Bulk ${operationType} error:`, bulkError);
                            // Handle bulk errors by marking affected records as failed
                            if (bulkError.writeErrors) {
                                bulkError.writeErrors.forEach(error => {
                                    const errorIndex = error.index;
                                    if (errorIndex < batchResults.length) {
                                        const failedRecord = batchResults[errorIndex];
                                        const originalStatus = failedRecord.status;

                                        failedRecord.status = 'Failed';
                                        failedRecord.action = `Database ${operationType} failed`;
                                        failedRecord.error = error.errmsg || error.message || 'Unknown database error';

                                        batchFailed++;
                                        if (originalStatus === 'Created') batchCreated--;
                                        if (originalStatus === 'Updated') batchUpdated--;
                                    }
                                });
                            }
                        }
                    }
                };

                // Execute create and update operations in parallel
                await Promise.all([
                    bulkCreateOps.length > 0 ? executeBulkWrite(bulkCreateOps, 'create') : Promise.resolve(),
                    bulkUpdateOps.length > 0 ? executeBulkWrite(bulkUpdateOps, 'update') : Promise.resolve()
                ]);
            }

            return {
                batchResults,
                batchCreated,
                batchUpdated,
                batchFailed,
                batchSkippedDuplicates,
                batchSkippedNoChanges,
                batchInvalidDates
            };
        };

        // Process all batches with controlled concurrency
        for (let batchIndex = 0; batchIndex < response.batchProgress.totalBatches; batchIndex += PARALLEL_BATCHES) {
            const batchPromises = [];

            // Create batch promises for parallel processing
            for (let j = 0; j < PARALLEL_BATCHES && (batchIndex + j) < response.batchProgress.totalBatches; j++) {
                const currentBatchIndex = batchIndex + j;
                const startIdx = currentBatchIndex * BATCH_SIZE;
                const endIdx = Math.min(startIdx + BATCH_SIZE, jsonData.length);
                const batch = jsonData.slice(startIdx, endIdx);

                response.batchProgress.currentBatch = currentBatchIndex + 1;
                response.batchProgress.currentBatchRecords = batch.length;

                batchPromises.push(processBatch(batch, currentBatchIndex));
            }

            // Wait for current batch group to complete
            const completedBatches = await Promise.all(batchPromises);

            // Update response with all completed batch results
            for (const completedBatch of completedBatches) {
                response.processedRecords += completedBatch.batchResults.length;
                response.successfulRecords += completedBatch.batchCreated + completedBatch.batchUpdated;
                response.failedRecords += completedBatch.batchFailed;
                response.summary.created += completedBatch.batchCreated;
                response.summary.updated += completedBatch.batchUpdated;
                response.summary.failed += completedBatch.batchFailed;
                response.summary.duplicatesInFile += completedBatch.batchSkippedDuplicates;
                response.summary.noChangesSkipped += completedBatch.batchSkippedNoChanges;
                response.summary.invalidDates += completedBatch.batchInvalidDates;
                response.summary.skippedTotal += completedBatch.batchSkippedDuplicates + completedBatch.batchSkippedNoChanges;

                // Track status updates
                const statusChanges = completedBatch.batchResults.filter(r => r.statusChanged);
                response.summary.statusUpdates.total += statusChanges.length;
                statusChanges.forEach(change => {
                    const status = change.assignedStatus;
                    if (!response.summary.statusUpdates.byStatus[status]) {
                        response.summary.statusUpdates.byStatus[status] = 0;
                    }
                    response.summary.statusUpdates.byStatus[status]++;
                });

                response.results.push(...completedBatch.batchResults);
            }

            // Send progress update
            res.write(JSON.stringify({
                type: 'batch_completed',
                batchCompleted: true,
                batchProgress: response.batchProgress,
                summary: response.summary,
                latestProcessedRecords: response.results.slice(-5) // Show last 5 processed records
            }) + '\n');
        }

        // Finalize response
        response.status = 'completed';
        response.endTime = new Date();
        response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;

        response.message = `Processing completed successfully. ` +
            `Created: ${response.summary.created}, ` +
            `Updated: ${response.summary.updated}, ` +
            `Failed: ${response.summary.failed}, ` +
            `File Duplicates: ${response.summary.duplicatesInFile}, ` +
            `No Changes Skipped: ${response.summary.noChangesSkipped}, ` +
            `Invalid Dates: ${response.summary.invalidDates}, ` +
            `Status Updates: ${response.summary.statusUpdates.total}, ` +
            `Total Skipped: ${response.summary.skippedTotal}`;

        // Final response
        res.write(JSON.stringify(response) + '\n');
        res.end();

    } catch (error) {
        console.error('AMC Contract bulk upload error:', error);
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

