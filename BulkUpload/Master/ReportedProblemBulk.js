const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const ReportedProblem = require('../../Model/MasterSchema/ReportedProblemSchema');
const path = require('path');

// Optimized: Pre-compiled regex patterns
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]/g;
const MULTISPACE_REGEX = /\s+/g;

// Memory storage with optimized settings
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.csv', '.xlsx', '.xls'];
        const allowedMimeTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
            'application/csv'
        ];

        if (allowedExts.includes(ext) || allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'), false);
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Optimized: Predefined field mappings for ReportedProblem schema
const FIELD_MAPPINGS = {
    'catalog': new Set(['catalog', 'catalogue', 'catalog_name', 'catalogname']),
    'codegroup': new Set(['codegroup', 'code_group', 'group', 'groupcode', 'group_code', 'partgroup', 'part_group']),
    'prodgroup': new Set(['prodgroup', 'prod_group', 'productgroup', 'product_group', 'productiongroup', 'production_group']),
    'name': new Set(['name', 'problemname', 'problem_name', 'componentname', 'component_name', 'itemname', 'item_name', 'reportname', 'report_name']),
    'shorttextforcode': new Set(['shorttextforcode', 'short_text_for_code', 'shorttext', 'short_text', 'description', 'desc', 'shortdescription', 'short_description', 'problem_description', 'problemdescription']),
    'status': new Set(['status', 'record_status', 'problem_status', 'current_status', 'active_status', 'report_status'])
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

// Optimized: Inline simple functions
function checkForChanges(existingRecord, newRecord, providedFields) {
    let hasAnyChange = false;
    const changeDetails = [];

    for (const field of providedFields) {
        const existingValue = existingRecord[field] ? String(existingRecord[field]).trim() : '';
        const newValue = newRecord[field] ? String(newRecord[field]).trim() : '';

        if (existingValue !== newValue) {
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

// Optimized Excel parsing with buffer reuse
function parseExcelFile(buffer) {
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });
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
                strict: false,
                skipLines: 0,
                skipEmptyLines: true
            }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);

        // Ensure stream is properly destroyed on errors
        stream.on('error', () => stream.destroy());
    });
}

// Validation function for ReportedProblem schema
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

    // Required field validation for ReportedProblem schema
    if (!cleanedRecord.catalog) {
        errors.push('Catalog is required');
    }
    if (!cleanedRecord.codegroup) {
        errors.push('Code Group is required');
    }
    if (!cleanedRecord.prodgroup) {
        errors.push('Product Group is required');
    }
    if (!cleanedRecord.name) {
        errors.push('Name is required');
    }
    if (!cleanedRecord.shorttextforcode) {
        errors.push('Short Text For Code is required');
    }

    // Early exit if required fields are missing
    if (errors.length > 0) {
        return { cleanedRecord, errors, providedFields };
    }

    // Length validation (reasonable limits for ReportedProblem)
    if (cleanedRecord.catalog.length > 100) {
        errors.push('Catalog too long (max 100 characters)');
    }
    if (cleanedRecord.codegroup.length > 100) {
        errors.push('Code Group too long (max 100 characters)');
    }
    if (cleanedRecord.prodgroup.length > 100) {
        errors.push('Product Group too long (max 100 characters)');
    }
    if (cleanedRecord.name.length > 200) {
        errors.push('Name too long (max 200 characters)');
    }
    if (cleanedRecord.shorttextforcode.length > 500) {
        errors.push('Short Text For Code too long (max 500 characters)');
    }

    // Set default status only if not provided
    if (!cleanedRecord.status || cleanedRecord.status.trim() === '') {
        cleanedRecord.status = 'Active';
    }

    return { cleanedRecord, errors, providedFields };
}

// Helper function to detect file type
function getFileType(fileName, mimeType) {
    const ext = path.extname(fileName).toLowerCase();

    // First check by extension
    if (ext === '.csv') return 'csv';
    if (ext === '.xlsx') return 'xlsx';
    if (ext === '.xls') return 'xls';

    // Then check by mime type
    if (mimeType === 'text/csv' || mimeType === 'application/csv') return 'csv';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
    if (mimeType === 'application/vnd.ms-excel') return 'xls';

    return null;
}

// MAIN ROUTE - ReportedProblem Bulk Upload
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
    const BATCH_SIZE = 2000; // Increased batch size for better performance
    const PARALLEL_BATCHES = 3; // Process multiple batches in parallel

    // Initialize response object with optimized structure
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

        // Detect file type properly
        const fileType = getFileType(req.file.originalname, req.file.mimetype);

        if (!fileType) {
            response.status = 'failed';
            response.errors.push(`Unsupported file format. File: ${req.file.originalname}, MIME: ${req.file.mimetype}`);
            return res.status(400).json(response);
        }

        // Parse file with optimized method selection
        let jsonData;
        try {
            if (fileType === 'csv') {
                jsonData = await parseCSVFile(req.file.buffer);
            } else if (fileType === 'xlsx' || fileType === 'xls') {
                jsonData = parseExcelFile(req.file.buffer);
            } else {
                throw new Error(`Unsupported file type: ${fileType}`);
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

        // Check for required fields for ReportedProblem schema
        const requiredFields = ['catalog', 'codegroup', 'prodgroup', 'name', 'shorttextforcode'];
        const missingRequiredFields = requiredFields.filter(field =>
            !Object.values(headerMapping).includes(field)
        );

        if (missingRequiredFields.length > 0) {
            response.status = 'failed';
            response.errors.push(
                `Required headers not found: ${missingRequiredFields.join(', ')}. Available headers: ${headers.join(', ')}`
            );
            return res.status(400).json(response);
        }

        // Send initial response
        res.write(JSON.stringify(response) + '\n');

        // Create unique identifier for checking duplicates (combination of catalog + codegroup + prodgroup + name)
        const processedIdentifiers = new Set();
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
            let currentRow = 0;
            // Process each record in the batch
            for (const record of batch) {
                currentRow++;
                const recordResult = {
                    row: currentRow,
                    catalog: '',
                    codegroup: '',
                    prodgroup: '',
                    name: '',
                    status: 'Processing',
                    action: '',
                    error: null,
                    warnings: [],
                    assignedStatus: null, // Track assigned status
                    statusChanged: false // Track if status was changed
                };

                try {
                    const { cleanedRecord, errors, providedFields } = validateRecord(record, headerMapping);
                    recordResult.catalog = cleanedRecord.catalog || 'Unknown';
                    recordResult.codegroup = cleanedRecord.codegroup || 'Unknown';
                    recordResult.prodgroup = cleanedRecord.prodgroup || 'Unknown';
                    recordResult.name = cleanedRecord.name || 'N/A';
                    recordResult.assignedStatus = cleanedRecord.status;

                    if (errors.length > 0) {
                        recordResult.status = 'Failed';
                        recordResult.error = errors.join(', ');
                        recordResult.action = 'Validation failed';
                        batchResults.push(recordResult);
                        batchFailed++;
                        continue;
                    }

                    // Create unique identifier for duplicate checking (catalog + codegroup + prodgroup + name)
                    const uniqueIdentifier = `${cleanedRecord.catalog}|${cleanedRecord.codegroup}|${cleanedRecord.prodgroup}|${cleanedRecord.name}`;

                    // Check for duplicates within the file
                    if (processedIdentifiers.has(uniqueIdentifier)) {
                        recordResult.status = 'Skipped';
                        recordResult.error = 'Duplicate record in file (same Catalog + Code Group + Product Group + Name)';
                        recordResult.action = 'Skipped due to file duplicate';
                        recordResult.warnings.push('Record with same Catalog, Code Group, Product Group, and Name already processed in this file');
                        batchResults.push(recordResult);
                        batchSkipped++;
                        continue;
                    }

                    processedIdentifiers.add(uniqueIdentifier);
                    validRecords.push({ cleanedRecord, recordResult, providedFields });

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
                // Find existing records in bulk using compound index
                const searchCriteria = validRecords.map(r => ({
                    catalog: r.cleanedRecord.catalog,
                    codegroup: r.cleanedRecord.codegroup,
                    prodgroup: r.cleanedRecord.prodgroup,
                    name: r.cleanedRecord.name
                }));

                const existingRecords = await ReportedProblem.find({
                    $or: searchCriteria
                }).lean();

                const existingRecordsMap = new Map();
                existingRecords.forEach(rec => {
                    const key = `${rec.catalog}|${rec.codegroup}|${rec.prodgroup}|${rec.name}`;
                    existingRecordsMap.set(key, rec);
                });

                // Prepare bulk operations
                const bulkOps = [];
                const now = new Date();

                for (const { cleanedRecord, recordResult, providedFields } of validRecords) {
                    const uniqueKey = `${cleanedRecord.catalog}|${cleanedRecord.codegroup}|${cleanedRecord.prodgroup}|${cleanedRecord.name}`;
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
                            const updateData = { modifiedAt: now };
                            providedFields.forEach(field => {
                                updateData[field] = cleanedRecord[field];
                            });

                            // Update status if provided in file but not in providedFields check
                            if (statusFromFile || cleanedRecord.status !== existingRecord.status) {
                                updateData.status = cleanedRecord.status;
                            }

                            bulkOps.push({
                                updateOne: {
                                    filter: {
                                        catalog: cleanedRecord.catalog,
                                        codegroup: cleanedRecord.codegroup,
                                        prodgroup: cleanedRecord.prodgroup,
                                        name: cleanedRecord.name
                                    },
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
                // Execute bulk operations if any
                if (bulkOps.length > 0) {
                    try {
                        console.log('📝 Executing bulkWrite with operations:', bulkOps.length);
                        console.log('🔍 Sample operations:', JSON.stringify(bulkOps.slice(0, 2), null, 2));

                        const bulkResult = await ReportedProblem.bulkWrite(bulkOps, {
                            ordered: false,
                            upsert: false
                        });

                        console.log('✅ Bulk write result:', {
                            insertedCount: bulkResult.insertedCount,
                            matchedCount: bulkResult.matchedCount,
                            modifiedCount: bulkResult.modifiedCount,
                            deletedCount: bulkResult.deletedCount,
                            upsertedCount: bulkResult.upsertedCount,
                            insertedIds: bulkResult.insertedIds,
                            upsertedIds: bulkResult.upsertedIds
                        });

                    } catch (bulkError) {
                        console.error('❌ BulkWrite Error:', bulkError);
                        console.error('Error details:', {
                            message: bulkError.message,
                            code: bulkError.code,
                            writeErrors: bulkError.writeErrors,
                            writeConcernErrors: bulkError.writeConcernErrors
                        });

                        // Handle bulk errors by marking affected records as failed
                        if (bulkError.writeErrors && bulkError.writeErrors.length > 0) {
                            bulkError.writeErrors.forEach((error, index) => {
                                console.error(`Write Error ${index}:`, error);

                                const failedRecord = batchResults.find(r => {
                                    const errorDoc = error.op?.insertOne?.document || error.op?.updateOne?.filter;
                                    if (!errorDoc) return false;

                                    return (
                                        r.catalog === errorDoc.catalog &&
                                        r.codegroup === errorDoc.codegroup &&
                                        r.prodgroup === errorDoc.prodgroup &&
                                        r.name === errorDoc.name
                                    );
                                });

                                if (failedRecord) {
                                    failedRecord.status = 'Failed';
                                    failedRecord.action = 'Bulk operation failed';
                                    failedRecord.error = error.errmsg || error.message;
                                    batchFailed++;

                                    // Adjust counters
                                    if (failedRecord.action === 'Created new record') batchCreated--;
                                    if (failedRecord.action === 'Updated existing record') batchUpdated--;
                                }
                            });
                        }
                    }
                } else {
                    console.log('⚠️ No bulk operations to execute');
                }

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
                    r => r.status === 'Skipped' && r.error && r.error.includes('Duplicate record in file')
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
                r => r.status === 'Skipped' && r.error && r.error.includes('Duplicate record in file')
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
            `Total Skipped: ${response.summary.skippedTotal}`;

        res.write(JSON.stringify(response) + '\n');
        res.end();

    } catch (error) {
        console.error('ReportedProblem bulk upload error:', error);
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
