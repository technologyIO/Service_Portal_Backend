const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const Branch = require('../../Model/CollectionSchema/BranchSchema');

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

        // Check file extension
        const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

        // Check MIME type
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

// Field mappings for Branch schema - comprehensive variations
const FIELD_MAPPINGS = {
    'name': new Set([
        'name', 'branchname', 'branch_name', 'branch-name',
        'office_name', 'officename', 'office-name', 'location_name',
        'locationname', 'branch', 'office'
    ]),
    'state': new Set([
        'state', 'statename', 'state_name', 'state-name',
        'province', 'region_state', 'location_state'
    ]),
    'district': new Set([
        'district', 'districtname', 'district_name', 'district-name',
        'area', 'zone', 'locality'
    ]),
    'region': new Set([
        'region', 'regionname', 'region_name', 'region-name',
        'territory', 'sector', 'division'
    ]),
    'country': new Set([
        'country', 'countryname', 'country_name', 'country-name',
        'nation'
    ]),
    // **FIXED:** Keep backend field name as branchShortCode to match schema
    'branchShortCode': new Set([
        'branchshortcode', 'branch_short_code', 'branch-short-code',
        'shortcode', 'short_code', 'short-code', 'code',
        'branch_code', 'branchcode', 'branch-code'
    ]),
    'status': new Set([
        'status', 'branch_status', 'branchstatus', 'branch-status',
        'record_status', 'current_status', 'active_status',
        'state', 'condition'
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
                break;
            }
        }
    }

    return mappedHeaders;
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

// Helper function to determine file type
function getFileType(fileName, mimeType) {
    const lowerFileName = fileName.toLowerCase();

    // Check by extension first
    if (lowerFileName.endsWith('.csv')) {
        return 'csv';
    } else if (lowerFileName.endsWith('.xlsx')) {
        return 'xlsx';
    } else if (lowerFileName.endsWith('.xls')) {
        return 'xls';
    }

    // Fallback to MIME type
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

// Generate unique identifier for Branch records (using name as unique key)
function generateUniqueKey(record) {
    return `${record.name}`.toLowerCase();
}

// Record validation to match Branch schema requirements
function validateRecord(record, headerMapping) {
    const cleanedRecord = {};
    const providedFields = [];
    const errors = [];

    // Map headers to schema fields
    for (const [originalHeader, schemaField] of Object.entries(headerMapping)) {
        if (record[originalHeader] === undefined || record[originalHeader] === null) continue;

        const value = String(record[originalHeader]).trim();
        if (value === '' || value === 'undefined' || value === 'null') continue;

        // Handle string fields
        cleanedRecord[schemaField] = value.replace(MULTISPACE_REGEX, ' ').trim();
        providedFields.push(schemaField);
    }

    // **FIXED:** Required fields validation to match header mapping
    const requiredFields = ['name', 'state', 'branchShortCode'];
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
        'name': 200,
        'state': 100,
        'district': 100,
        'region': 100,
        'country': 100,
        'branchShortCode': 50, // **FIXED:** Updated field name
        'status': 50
    };

    for (const [field, maxLength] of Object.entries(fieldLimits)) {
        if (cleanedRecord[field] && cleanedRecord[field].length > maxLength) {
            errors.push(`${field} too long (max ${maxLength} characters)`);
        }
    }

    // Set default values
    if (!cleanedRecord.status || cleanedRecord.status.trim() === '') {
        cleanedRecord.status = 'Active';
    }

    // Set timestamps
    const now = new Date();
    cleanedRecord.createdAt = now;
    cleanedRecord.modifiedAt = now;

    return { cleanedRecord, errors, providedFields };
}



// MAIN ROUTE - Branch Bulk Upload
router.post('/branch-bulk-upload', upload.single('file'), async (req, res) => {
    const BATCH_SIZE = 1000;
    const PARALLEL_BATCHES = 3;
    const BULK_WRITE_BATCH_SIZE = 300;

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

        // Map headers with optimized method
        const headers = Object.keys(jsonData[0] || {});
        const headerMapping = mapHeaders(headers);
        response.headerMapping = headerMapping;

        const requiredFields = ['name', 'state', 'branchShortCode']; // **FIXED:** Updated to match header mapping
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

        // Process data in parallel batches
        const processBatch = async (batch, batchIndex) => {
            const batchResults = [];
            const validRecords = [];
            let batchCreated = 0;
            let batchUpdated = 0;
            let batchFailed = 0;
            let batchSkipped = 0;
            let batchStatusUpdates = 0;

            // Process each record in the batch
            for (const record of batch) {
                currentRow++;
                const recordResult = {
                    row: currentRow,
                    name: '',
                    state: '',
                    branchShortCode: '', // **FIXED:** Updated field name
                    status: 'Processing',
                    action: '',
                    error: null,
                    warnings: [],
                    assignedStatus: null,
                    statusChanged: false
                };

                try {
                    const { cleanedRecord, errors, providedFields } = validateRecord(record, headerMapping);

                    // Update record result with cleaned data
                    recordResult.name = cleanedRecord.name || 'Unknown';
                    recordResult.state = cleanedRecord.state || 'Unknown';
                    recordResult.branchShortCode = cleanedRecord.branchShortCode || 'Unknown';
                    recordResult.assignedStatus = cleanedRecord.status;

                    if (errors.length > 0) {
                        recordResult.status = 'Failed';
                        recordResult.error = errors.join(', ');
                        recordResult.action = 'Validation failed';
                        batchResults.push(recordResult);
                        batchFailed++;
                        continue;
                    }

                    // Generate unique key for duplicate checking (using name)
                    const uniqueKey = generateUniqueKey(cleanedRecord);

                    // Check for duplicates within the file
                    if (processedUniqueKeys.has(uniqueKey)) {
                        recordResult.status = 'Skipped';
                        recordResult.error = 'Duplicate Branch Name in file';
                        recordResult.action = 'Skipped due to file duplicate';
                        recordResult.warnings.push('Branch Name already processed in this file');
                        batchResults.push(recordResult);
                        batchSkipped++;
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
                // Find existing records in bulk using name
                const branchNames = validRecords.map(r => r.cleanedRecord.name);
                const existingRecords = await Branch.find({
                    name: { $in: branchNames }
                }).lean();

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

                        // Handle status for existing records
                        const statusFromFile = providedFields.includes('status');
                        if (!statusFromFile) {
                            // Keep existing status if not provided in file
                            cleanedRecord.status = existingRecord.status;
                            recordResult.assignedStatus = existingRecord.status;
                        } else if (cleanedRecord.status !== existingRecord.status) {
                            recordResult.statusChanged = true;
                            batchStatusUpdates++;
                        }

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

                            batchSkipped++;
                        }
                    } else {
                        bulkCreateOps.push({
                            insertOne: {
                                document: {
                                    ...cleanedRecord
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
                // Execute bulk operations in smaller chunks with proper logging
                const executeBulkWrite = async (operations, operationType) => {
                    let totalInserted = 0;
                    let totalUpdated = 0;

                    for (let i = 0; i < operations.length; i += BULK_WRITE_BATCH_SIZE) {
                        const chunk = operations.slice(i, i + BULK_WRITE_BATCH_SIZE);
                        try {
                            const result = await Branch.bulkWrite(chunk, {
                                ordered: false,
                                setDefaultsOnInsert: true
                            });

                            // **ADDED:** Log bulk write results
                            console.log(`${operationType} BulkWrite Result:`, {
                                insertedCount: result.insertedCount,
                                matchedCount: result.matchedCount,
                                modifiedCount: result.modifiedCount,
                                deletedCount: result.deletedCount,
                                upsertedCount: result.upsertedCount,
                                upsertedIds: result.upsertedIds
                            });

                            totalInserted += result.insertedCount || 0;
                            totalUpdated += result.modifiedCount || 0;

                        } catch (bulkError) {
                            console.error(`${operationType} BulkWrite Error:`, bulkError);

                            // Handle bulk errors by marking affected records as failed
                            if (bulkError.writeErrors) {
                                bulkError.writeErrors.forEach(error => {
                                    console.error('Individual Write Error:', error);
                                    const failedRecord = batchResults.find(r => {
                                        const errorDoc = error.op?.insertOne?.document || error.op?.updateOne?.update?.$set;
                                        return errorDoc && r.name === errorDoc.name;
                                    });
                                    if (failedRecord) {
                                        const previousStatus = failedRecord.status;
                                        failedRecord.status = 'Failed';
                                        failedRecord.action = 'Bulk operation failed';
                                        failedRecord.error = error.errmsg;
                                        batchFailed++;
                                        if (previousStatus === 'Created') batchCreated--;
                                        if (previousStatus === 'Updated') batchUpdated--;
                                    }
                                });
                            }
                        }
                    }

                    console.log(`${operationType} Summary: Inserted=${totalInserted}, Updated=${totalUpdated}`);
                    return { totalInserted, totalUpdated };
                };

                // Execute create and update operations in parallel
                const [createResults, updateResults] = await Promise.all([
                    bulkCreateOps.length > 0 ? executeBulkWrite(bulkCreateOps, 'CREATE') : Promise.resolve({ totalInserted: 0, totalUpdated: 0 }),
                    bulkUpdateOps.length > 0 ? executeBulkWrite(bulkUpdateOps, 'UPDATE') : Promise.resolve({ totalInserted: 0, totalUpdated: 0 })
                ]);


                // Execute create and update operations in parallel
                await Promise.all([
                    bulkCreateOps.length > 0 ? executeBulkWrite(bulkCreateOps) : Promise.resolve(),
                    bulkUpdateOps.length > 0 ? executeBulkWrite(bulkUpdateOps) : Promise.resolve()
                ]);
            }

            return {
                batchResults,
                batchCreated,
                batchUpdated,
                batchFailed,
                batchSkipped,
                batchStatusUpdates
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
                response.successfulRecords += completedBatch.batchCreated + completedBatch.batchUpdated;
                response.failedRecords += completedBatch.batchFailed;
                response.summary.created += completedBatch.batchCreated;
                response.summary.updated += completedBatch.batchUpdated;
                response.summary.failed += completedBatch.batchFailed;
                response.summary.skippedTotal += completedBatch.batchSkipped;
                response.summary.duplicatesInFile += completedBatch.batchResults.filter(
                    r => r.status === 'Skipped' && r.error === 'Duplicate Branch Name in file'
                ).length;
                response.summary.noChangesSkipped += completedBatch.batchResults.filter(
                    r => r.status === 'Skipped' && r.action === 'No changes detected'
                ).length;

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

                res.write(JSON.stringify({
                    ...response,
                    batchCompleted: true,
                    batchSummary: {
                        created: completedBatch.batchCreated,
                        updated: completedBatch.batchUpdated,
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
            response.successfulRecords += completedBatch.batchCreated + completedBatch.batchUpdated;
            response.failedRecords += completedBatch.batchFailed;
            response.summary.created += completedBatch.batchCreated;
            response.summary.updated += completedBatch.batchUpdated;
            response.summary.failed += completedBatch.batchFailed;
            response.summary.skippedTotal += completedBatch.batchSkipped;
            response.summary.duplicatesInFile += completedBatch.batchResults.filter(
                r => r.status === 'Skipped' && r.error === 'Duplicate Branch Name in file'
            ).length;
            response.summary.noChangesSkipped += completedBatch.batchResults.filter(
                r => r.status === 'Skipped' && r.action === 'No changes detected'
            ).length;
            response.results.push(...completedBatch.batchResults);

            res.write(JSON.stringify({
                ...response,
                batchCompleted: true,
                batchSummary: {
                    created: completedBatch.batchCreated,
                    updated: completedBatch.batchUpdated,
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

        response.message = `Processing completed successfully. ` +
            `Created: ${response.summary.created}, ` +
            `Updated: ${response.summary.updated}, ` +
            `Failed: ${response.summary.failed}, ` +
            `File Duplicates: ${response.summary.duplicatesInFile}, ` +
            `Existing Records: ${response.summary.existingRecords}, ` +
            `No Changes Skipped: ${response.summary.noChangesSkipped}, ` +
            `Total Skipped: ${response.summary.skippedTotal}, ` +
            `Status Updates: ${response.summary.statusUpdates.total}`;

        res.write(JSON.stringify(response) + '\n');
        res.end();

    } catch (error) {
        console.error('Branch bulk upload error:', error);
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
