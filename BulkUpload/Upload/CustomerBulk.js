const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const Customer = require('../../Model/UploadSchema/CustomerSchema');

// Optimized: Pre-compiled regex patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\+]?[0-9\-\(\)\s]{10,}$/;
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
    'customercodeid': new Set(['customercodeid', 'customercode', 'customer_code', 'customer_id', 'custcode', 'cust_code', 'code']),
    'customername': new Set(['customername', 'customer_name', 'name1', 'name', 'customername1', 'customer_name1']),
    'hospitalname': new Set(['hospitalname', 'hospital_name', 'name2', 'customername2', 'customer_name2', 'hospital']),
    'street': new Set(['street', 'streetaddress', 'street_address', 'address1', 'address', 'addr1']),
    'city': new Set(['city', 'cityname', 'city_name']),
    'postalcode': new Set(['postalcode', 'postal_code', 'pincode', 'pin_code', 'zipcode', 'zip_code', 'zip']),
    'district': new Set(['district', 'dist', 'districtname', 'district_name']),
    'state': new Set(['state', 'statename', 'state_name']),
    'region': new Set(['region', 'regionname', 'region_name', 'zone']),
    'country': new Set(['country', 'countryname', 'country_name', 'nation']),
    'telephone': new Set(['telephone', 'phone', 'phonenumber', 'phone_number', 'mobile', 'contact', 'contactno', 'contact_no']),
    'taxnumber1': new Set(['taxnumber1', 'tax_number1', 'taxno1', 'tax_no1', 'gst', 'gstin', 'tax1']),
    'taxnumber2': new Set(['taxnumber2', 'tax_number2', 'taxno2', 'tax_no2', 'pan', 'tax2']),
    'email': new Set(['email', 'emailaddress', 'email_address', 'emailid', 'email_id']),
    'customertype': new Set(['customertype', 'customer_type', 'type', 'custtype', 'cust_type'])
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
                strict: true,
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
    if (!cleanedRecord.customercodeid) {
        errors.push('Customer Code is required');
    }
    if (!cleanedRecord.customername) {
        errors.push('Customer Name is required');
    }

    // Early exit if required fields are missing
    if (errors.length > 0) {
        return { cleanedRecord, errors, providedFields };
    }

    // Length validation
    if (cleanedRecord.customercodeid.length > 50) {
        errors.push('Customer Code too long (max 50 characters)');
    }

    // Email validation - only if provided
    if (cleanedRecord.email && !EMAIL_REGEX.test(cleanedRecord.email)) {
        errors.push('Invalid email format');
    }

    // Phone validation - only if provided
    if (cleanedRecord.telephone && !PHONE_REGEX.test(cleanedRecord.telephone)) {
        errors.push('Invalid telephone format');
    }

    // Default status
    if (!cleanedRecord.status) {
        cleanedRecord.status = 'Active';
    }

    return { cleanedRecord, errors, providedFields };
}

// MAIN ROUTE - Optimized with parallel processing and bulk operations
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

        // Parse file with optimized method selection
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

        // Map headers with optimized method
        const headers = Object.keys(jsonData[0] || {});
        const headerMapping = mapHeaders(headers);
        response.headerMapping = headerMapping;

        // Check for required fields with optimized lookup
        const hasCustomerCodeField = Object.values(headerMapping).some(f => f === 'customercodeid');
        if (!hasCustomerCodeField) {
            response.status = 'failed';
            response.errors.push(
                `Required header not found: Customer Code. Available headers: ${headers.join(', ')}`
            );
            return res.status(400).json(response);
        }

        // Send initial response
        res.write(JSON.stringify(response) + '\n');

        const processedCustomerCodes = new Set();
        let currentRow = 0;

        // Process data in parallel batches
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
                    customercodeid: '',
                    customername: '',
                    status: 'Processing',
                    action: '',
                    error: null,
                    warnings: []
                };

                try {
                    const { cleanedRecord, errors, providedFields } = validateRecord(record, headerMapping);
                    recordResult.customercodeid = cleanedRecord.customercodeid || 'Unknown';
                    recordResult.customername = cleanedRecord.customername || 'N/A';

                    if (errors.length > 0) {
                        recordResult.status = 'Failed';
                        recordResult.error = errors.join(', ');
                        recordResult.action = 'Validation failed';
                        batchResults.push(recordResult);
                        batchFailed++;
                        continue;
                    }

                    // Check for duplicates within the file
                    if (processedCustomerCodes.has(cleanedRecord.customercodeid)) {
                        recordResult.status = 'Skipped';
                        recordResult.error = 'Duplicate Customer Code in file';
                        recordResult.action = 'Skipped due to file duplicate';
                        recordResult.warnings.push('Customer Code already processed in this file');
                        batchResults.push(recordResult);
                        batchSkipped++;
                        continue;
                    }

                    processedCustomerCodes.add(cleanedRecord.customercodeid);
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
                // Find existing records in bulk
                const customerCodes = validRecords.map(r => r.cleanedRecord.customercodeid);
                const existingRecords = await Customer.find({
                    customercodeid: { $in: customerCodes }
                }).lean();

                const existingRecordsMap = new Map();
                existingRecords.forEach(rec => {
                    existingRecordsMap.set(rec.customercodeid, rec);
                });

                // Prepare bulk operations
                const bulkOps = [];
                const now = new Date();

                for (const { cleanedRecord, recordResult, providedFields } of validRecords) {
                    const existingRecord = existingRecordsMap.get(cleanedRecord.customercodeid);

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
                                    filter: { customercodeid: cleanedRecord.customercodeid },
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
                if (bulkOps.length > 0) {
                    try {
                        await Customer.bulkWrite(bulkOps, { ordered: false });
                    } catch (bulkError) {
                        // Handle bulk errors by marking affected records as failed
                        if (bulkError.writeErrors) {
                            bulkError.writeErrors.forEach(error => {
                                const failedRecord = batchResults.find(r => 
                                    r.customercodeid === error.op?.customercodeid ||
                                    r.customercodeid === error.op?.updateOne?.filter?.customercodeid
                                );
                                if (failedRecord) {
                                    failedRecord.status = 'Failed';
                                    failedRecord.action = 'Bulk operation failed';
                                    failedRecord.error = error.errmsg;
                                    batchFailed++;
                                    if (failedRecord.status === 'Created') batchCreated--;
                                    if (failedRecord.status === 'Updated') batchUpdated--;
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
                response.successfulRecords += completedBatch.batchCreated + completedBatch.batchUpdated;
                response.failedRecords += completedBatch.batchFailed;
                response.summary.created += completedBatch.batchCreated;
                response.summary.updated += completedBatch.batchUpdated;
                response.summary.failed += completedBatch.batchFailed;
                response.summary.skippedTotal += completedBatch.batchSkipped;
                response.summary.duplicatesInFile += completedBatch.batchResults.filter(
                    r => r.status === 'Skipped' && r.error === 'Duplicate Customer Code in file'
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
                r => r.status === 'Skipped' && r.error === 'Duplicate Customer Code in file'
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
        console.error('Customer bulk upload error:', error);
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