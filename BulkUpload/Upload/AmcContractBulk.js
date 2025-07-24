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
        const ext = file.originalname.toLowerCase().slice(-4);
        if (
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // .xlsx
            file.mimetype === 'application/vnd.ms-excel' || // .xls
            file.mimetype === 'text/csv' || // .csv
            file.mimetype === 'application/csv' ||
            ext === '.csv' ||
            ext === '.xlsx' ||
            ext === '.xls'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'), false);
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Optimized: Predefined field mappings for faster access
const FIELD_MAPPINGS = {
    'salesdoc': new Set(['salesdoc', 'sales_doc', 'salesdocument', 'sales_document', 'document', 'docno', 'doc_no']),
    'startdate': new Set(['startdate', 'start_date', 'begin_date', 'begindate', 'fromdate', 'from_date']),
    'enddate': new Set(['enddate', 'end_date', 'finish_date', 'finishdate', 'todate', 'to_date', 'expiry_date', 'expirydate']),
    'satypeZDRC_ZDRN': new Set(['satype', 'sa_type', 'satypezdrc_zdrn', 'satype_zdrc_zdrn', 'type', 'satypezdrczdrn']),
    'serialnumber': new Set(['serialnumber', 'serial_number', 'serialno', 'serial_no', 'sno']),
    'materialcode': new Set(['materialcode', 'material_code', 'partno', 'part_no', 'code', 'item_code', 'product_code'])
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
    if (cleanedRecord.salesdoc.length > 50) {
        errors.push('Sales Doc too long (max 50 characters)');
    }
    if (cleanedRecord.serialnumber.length > 50) {
        errors.push('Serial Number too long (max 50 characters)');
    }
    if (cleanedRecord.materialcode.length > 50) {
        errors.push('Material Code too long (max 50 characters)');
    }

    // Date validation
    if (cleanedRecord.startdate && cleanedRecord.enddate && cleanedRecord.startdate > cleanedRecord.enddate) {
        errors.push('Start Date cannot be later than End Date');
    }

    // Default status
    cleanedRecord.status = 'Active';

    return { cleanedRecord, errors, providedFields };
}

// Enhanced comparison function for all fields
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
            // String comparison for non-date fields
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

// MAIN ROUTE - Complete implementation with composite key handling
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
    const BATCH_SIZE = 2000; // Reduced for better memory management
    const PARALLEL_BATCHES = 3; // Reduced for stability

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
            noChangesSkipped: 0,
            invalidDates: 0
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

        // Parse file
        let jsonData;
        const fileName = req.file.originalname.toLowerCase();
        const fileExt = fileName.slice(-4);

        try {
            if (fileExt === '.csv') {
                jsonData = await parseCSVFile(req.file.buffer);
            } else if (fileExt === '.xlsx' || fileExt === '.xls') {
                jsonData = parseExcelFile(req.file.buffer);
            } else {
                throw new Error('Unsupported file format');
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

        // Check for required fields
        const hasRequiredFields = ['salesdoc', 'serialnumber', 'satypeZDRC_ZDRN', 'materialcode'].every(field => 
            Object.values(headerMapping).includes(field)
        );
        if (!hasRequiredFields) {
            response.status = 'failed';
            response.errors.push(
                `Required headers not found. Available headers: ${headers.join(', ')}`
            );
            return res.status(400).json(response);
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
                    warnings: []
                };

                try {
                    const { cleanedRecord, errors, providedFields } = validateRecord(record, headerMapping);
                    recordResult.salesdoc = cleanedRecord.salesdoc || 'Unknown';
                    recordResult.serialnumber = cleanedRecord.serialnumber || 'Unknown';

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
                const bulkOps = [];
                const now = new Date();

                for (const { cleanedRecord, recordResult, providedFields, compositeKey } of validRecords) {
                    const existingRecord = existingRecordsMap.get(compositeKey);

                    if (existingRecord) {
                        response.summary.existingRecords++;

                        const comparisonResult = checkForChanges(existingRecord, cleanedRecord, providedFields);

                        if (comparisonResult.hasChanges) {
                            const updateData = { modifiedAt: now };
                            providedFields.forEach(field => {
                                updateData[field] = cleanedRecord[field];
                            });

                            bulkOps.push({
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
                        recordResult.changesText = 'New record created';

                        batchCreated++;
                    }

                    batchResults.push(recordResult);
                }

                // Execute bulk operations if any
                if (bulkOps.length > 0) {
                    try {
                        await AMCContract.bulkWrite(bulkOps, { ordered: false });
                    } catch (bulkError) {
                        console.error('Bulk write error:', bulkError);
                        
                        // Handle individual bulk errors
                        if (bulkError.writeErrors) {
                            bulkError.writeErrors.forEach(error => {
                                // Find the corresponding record and mark as failed
                                const errorIndex = error.index;
                                if (errorIndex < batchResults.length) {
                                    const failedRecord = batchResults[errorIndex];
                                    const originalStatus = failedRecord.status;
                                    
                                    failedRecord.status = 'Failed';
                                    failedRecord.action = 'Database operation failed';
                                    failedRecord.error = error.errmsg || 'Unknown database error';
                                    
                                    batchFailed++;
                                    if (originalStatus === 'Created') batchCreated--;
                                    if (originalStatus === 'Updated') batchUpdated--;
                                }
                            });
                        }
                    }
                }
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

        // Process all batches
        const allBatches = [];
        for (let batchIndex = 0; batchIndex < response.batchProgress.totalBatches; batchIndex++) {
            const startIdx = batchIndex * BATCH_SIZE;
            const endIdx = Math.min(startIdx + BATCH_SIZE, jsonData.length);
            const batch = jsonData.slice(startIdx, endIdx);
            allBatches.push({ batch, batchIndex });
        }

        // Process batches with controlled parallelism
        for (let i = 0; i < allBatches.length; i += PARALLEL_BATCHES) {
            const batchPromises = [];
            
            for (let j = 0; j < PARALLEL_BATCHES && (i + j) < allBatches.length; j++) {
                const { batch, batchIndex } = allBatches[i + j];
                
                response.batchProgress.currentBatch = batchIndex + 1;
                response.batchProgress.currentBatchRecords = batch.length;
                
                batchPromises.push(processBatch(batch, batchIndex));
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
                response.results.push(...completedBatch.batchResults);
            }

            // Send progress update
            res.write(JSON.stringify({
                ...response,
                batchCompleted: true,
                batchProgress: response.batchProgress,
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
