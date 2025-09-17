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
            file.mimetype === 'application/vnd.oasis.opendocument.spreadsheet' || // .ods
            ext === '.csv' ||
            ext === '.xlsx' ||
            ext === '.xls' ||
            ext === '.ods'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel (.xlsx, .xls, .ods) and CSV files are allowed'), false);
        }
    },
    limits: { fileSize: 50 * 1024 * 1024 }
});

// Optimized: Predefined field mappings for faster access
const FIELD_MAPPINGS = {
    'customercodeid': new Set(['customercodeid', 'customercode', 'customer_code', 'customer_id', 'custcode', 'cust_code', 'code', 'customer']),
    'customername': new Set(['customername', 'customer_name', 'name1', 'name', 'customername1', 'customer_name1', 'name 1']),
    'hospitalname': new Set(['hospitalname', 'hospital_name', 'name2', 'customername2', 'customer_name2', 'hospital', 'name 2']),
    'street': new Set(['street', 'streetaddress', 'street_address', 'address1', 'address', 'addr1']),
    'city': new Set(['city', 'cityname', 'city_name']),
    'postalcode': new Set(['postalcode', 'postal_code', 'pincode', 'pin_code', 'zipcode', 'zip_code', 'zip']),
    'district': new Set(['district', 'dist', 'districtname', 'district_name']),
    'state': new Set(['state', 'statename', 'state_name']),
    'region': new Set(['region', 'regionname', 'region_name', 'zone', 'rg']),
    'country': new Set(['country', 'countryname', 'country_name', 'nation', 'cty']),
    'telephone': new Set(['telephone', 'phone', 'phonenumber', 'phone_number', 'mobile', 'contact', 'contactno', 'contact_no', 'telephone 1']),
    'taxnumber1': new Set(['taxnumber1', 'tax_number1', 'taxno1', 'tax_no1', 'gst', 'gstin', 'tax1', 'tax number 1']),
    'taxnumber2': new Set(['taxnumber2', 'tax_number2', 'taxno2', 'tax_no2', 'pan', 'tax2', 'tax number 2']),
    'email': new Set(['email', 'emailaddress', 'email_address', 'emailid', 'email_id', 'e-mail address']),
    'customertype': new Set(['customertype', 'customer_type', 'type', 'custtype', 'cust_type', 'customer type']),
    'status': new Set(['status', 'customer_status', 'record_status', 'current_status', 'active_status', 'account_status'])
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

// Enhanced change detection with better tracking
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

// Enhanced record validation with comprehensive error checking
function validateRecord(record, headerMapping) {
    const cleanedRecord = {};
    const providedFields = [];
    const errors = [];
    const warnings = [];

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
   
    if (!cleanedRecord.city) {
        errors.push('City is required');
    }
    if (!cleanedRecord.postalcode) {
        errors.push('Postal Code is required');
    }
    if (!cleanedRecord.region) {
        errors.push('Region is required');
    }
    if (!cleanedRecord.country) {
        errors.push('Country is required');
    }
    if (!cleanedRecord.telephone) {
        errors.push('Telephone is required');
    }
    if (!cleanedRecord.email) {
        errors.push('Email is required');
    }

    // Early exit if required fields are missing
    if (errors.length > 0) {
        return { cleanedRecord, errors, warnings, providedFields };
    }

    // Length validation
    if (cleanedRecord.customercodeid.length > 50) {
        errors.push('Customer Code too long (max 50 characters)');
    }
    if (cleanedRecord.customername && cleanedRecord.customername.length > 100) {
        warnings.push('Customer Name is quite long');
    }

    // Email validation
    if (cleanedRecord.email && !EMAIL_REGEX.test(cleanedRecord.email)) {
        errors.push('Invalid email format');
    }

    // Phone validation
    if (cleanedRecord.telephone && !PHONE_REGEX.test(cleanedRecord.telephone)) {
        errors.push('Invalid telephone format');
    }

    // Set default status only if not provided
    if (!cleanedRecord.status || cleanedRecord.status.trim() === '') {
        cleanedRecord.status = 'Active';
        warnings.push('Status not provided, defaulted to Active');
    }

    return { cleanedRecord, errors, warnings, providedFields };
}

// Helper function to create latest records update for frontend
function createLatestRecordsUpdate(validRecords, batchResults, existingRecordsMap) {
    const latestRecords = [];
    let recordIndex = 0;

    // Add sample of created records
    for (let i = 0; i < Math.min(3, batchResults.batchCreated); i++) {
        if (recordIndex < validRecords.length) {
            const record = validRecords[recordIndex];
            const existing = existingRecordsMap.get(record.cleanedRecord.customercodeid);
            
            if (!existing) {
                latestRecords.push({
                    row: record.recordResult.row,
                    customercodeid: record.cleanedRecord.customercodeid,
                    customername: record.cleanedRecord.customername,
                    hospitalname: record.cleanedRecord.hospitalname,
                    status: "Created",
                    action: "Created new customer record",
                    error: null,
                    warnings: record.recordResult.warnings || [],
                    assignedStatus: record.cleanedRecord.status,
                    statusChanged: false,
                    changeDetails: [],
                    changesText: "New customer record created"
                });
                recordIndex++;
            }
        }
    }

    // Add sample of updated records
    for (let i = 0; i < Math.min(3, batchResults.batchUpdated); i++) {
        if (recordIndex < validRecords.length) {
            const record = validRecords[recordIndex];
            const existing = existingRecordsMap.get(record.cleanedRecord.customercodeid);
            
            if (existing) {
                latestRecords.push({
                    row: record.recordResult.row,
                    customercodeid: record.cleanedRecord.customercodeid,
                    customername: record.cleanedRecord.customername,
                    hospitalname: record.cleanedRecord.hospitalname,
                    status: "Updated",
                    action: "Updated existing customer record",
                    error: null,
                    warnings: record.recordResult.warnings || [],
                    assignedStatus: record.cleanedRecord.status,
                    statusChanged: record.recordResult.statusChanged || false,
                    changeDetails: record.recordResult.changeDetails || [],
                    changesText: record.recordResult.changeDetails && record.recordResult.changeDetails.length > 0 
                        ? `Updated: ${record.recordResult.changeDetails.map(c => c.field).join(', ')}`
                        : "Customer record updated"
                });
                recordIndex++;
            }
        }
    }

    return latestRecords;
}

router.post('/bulk-upload', upload.single('file'), async (req, res) => {
    const BATCH_SIZE = 1000; // Reduced for better performance
    const PARALLEL_BATCHES = 2; // Reduced for stability

    // Enhanced response structure
    const response = {
        status: 'processing',
        startTime: new Date(),
        totalRecords: 0,
        processedRecords: 0,
        successfulRecords: 0,
        failedRecords: 0,
        results: [], // Only failed records
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

        // Set streaming headers
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let jsonData;
        const fileName = req.file.originalname.toLowerCase();

        try {
            if (fileName.endsWith('.csv')) {
                jsonData = await parseCSVFile(req.file.buffer);
            } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
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

        const headers = Object.keys(jsonData[0] || {});
        const headerMapping = mapHeaders(headers);
        response.headerMapping = headerMapping;

        // Check for required fields
        const hasCustomerCodeField = Object.values(headerMapping).some(f => f === 'customercodeid');
        if (!hasCustomerCodeField) {
            response.status = 'failed';
            response.errors.push(
                `Required header not found: Customer Code. Available headers: ${headers.join(', ')}`
            );
            return res.status(400).json(response);
        }

        // Initial response send
        res.write(JSON.stringify(response) + '\n');

        const processedCustomerCodes = new Set();
        let currentRow = 0;

        const processBatch = async (batch, batchIndex) => {
            const batchFailedRecords = [];
            const validRecords = [];
            let batchFailed = 0;
            let batchCreated = 0;
            let batchUpdated = 0;
            let batchNoChangesSkipped = 0;
            let batchStatusUpdates = 0;

            // Process and validate each record
            for (const record of batch) {
                currentRow++;
                const recordResult = {
                    row: currentRow,
                    customercodeid: '',
                    customername: '',
                    hospitalname: '',
                    status: 'Processing',
                    action: '',
                    error: null,
                    warnings: [],
                    assignedStatus: null,
                    statusChanged: false,
                    changeDetails: []
                };

                try {
                    const { cleanedRecord, errors, warnings, providedFields } = validateRecord(record, headerMapping);
                    recordResult.customercodeid = cleanedRecord.customercodeid || 'Unknown';
                    recordResult.customername = cleanedRecord.customername || 'N/A';
                    recordResult.hospitalname = cleanedRecord.hospitalname || 'N/A';
                    recordResult.assignedStatus = cleanedRecord.status;
                    recordResult.warnings = warnings;

                    if (errors.length > 0) {
                        recordResult.status = 'Failed';
                        recordResult.error = errors.join(', ');
                        recordResult.action = 'Validation failed';
                        batchFailedRecords.push(recordResult);
                        batchFailed++;
                        continue;
                    }

                    // Check for duplicates in file
                    if (processedCustomerCodes.has(cleanedRecord.customercodeid)) {
                        recordResult.status = 'Failed';
                        recordResult.error = 'Duplicate Customer Code in file';
                        recordResult.action = 'Skipped due to file duplicate';
                        recordResult.warnings.push('Customer Code already processed in this file');
                        batchFailedRecords.push(recordResult);
                        batchFailed++;
                        continue;
                    }

                    processedCustomerCodes.add(cleanedRecord.customercodeid);
                    validRecords.push({ cleanedRecord, recordResult, providedFields });

                } catch (err) {
                    recordResult.status = 'Failed';
                    recordResult.action = 'Validation error';
                    recordResult.error = err.message;
                    batchFailedRecords.push(recordResult);
                    batchFailed++;
                }
            }

            // Database operations for valid records
            if (validRecords.length > 0) {
                const customerCodes = validRecords.map(r => r.cleanedRecord.customercodeid);
                const existingRecords = await Customer.find({
                    customercodeid: { $in: customerCodes }
                }).lean();

                const existingRecordsMap = new Map();
                existingRecords.forEach(rec => {
                    existingRecordsMap.set(rec.customercodeid, rec);
                });

                const bulkOps = [];
                const now = new Date();

                for (const { cleanedRecord, recordResult, providedFields } of validRecords) {
                    const existingRecord = existingRecordsMap.get(cleanedRecord.customercodeid);

                    if (existingRecord) {
                        response.summary.existingRecords++;

                        // Handle status updates
                        const statusFromFile = providedFields.includes('status');
                        if (!statusFromFile) {
                            cleanedRecord.status = existingRecord.status;
                            recordResult.assignedStatus = existingRecord.status;
                        } else if (cleanedRecord.status !== existingRecord.status) {
                            recordResult.statusChanged = true;
                            batchStatusUpdates++;
                        }

                        const comparisonResult = checkForChanges(existingRecord, cleanedRecord, providedFields);
                        recordResult.changeDetails = comparisonResult.changeDetails;

                        if (comparisonResult.hasChanges) {
                            const updateData = { modifiedAt: now };
                            providedFields.forEach(field => {
                                updateData[field] = cleanedRecord[field];
                            });

                            if (statusFromFile || cleanedRecord.status !== existingRecord.status) {
                                updateData.status = cleanedRecord.status;
                            }

                            bulkOps.push({
                                updateOne: {
                                    filter: { customercodeid: cleanedRecord.customercodeid },
                                    update: { $set: updateData }
                                }
                            });

                            batchUpdated++;
                        } else {
                            batchNoChangesSkipped++;
                        }
                    } else {
                        // Create new record
                        bulkOps.push({
                            insertOne: {
                                document: {
                                    ...cleanedRecord,
                                    createdAt: now,
                                    modifiedAt: now
                                }
                            }
                        });

                        batchCreated++;
                    }
                }

                // Execute bulk operations
                if (bulkOps.length > 0) {
                    try {
                        await Customer.bulkWrite(bulkOps, { ordered: false });
                    } catch (bulkError) {
                        if (bulkError.writeErrors) {
                            bulkError.writeErrors.forEach(error => {
                                const failedOp = error.op;
                                const customerCode = failedOp?.customercodeid || 
                                                   failedOp?.insertOne?.document?.customercodeid ||
                                                   failedOp?.updateOne?.filter?.customercodeid || 'Unknown';

                                batchFailedRecords.push({
                                    row: 'DB Error',
                                    customercodeid: customerCode,
                                    customername: failedOp?.customername || 'N/A',
                                    hospitalname: failedOp?.hospitalname || 'N/A',
                                    status: 'Failed',
                                    action: 'Database operation failed',
                                    error: error.errmsg || 'Unknown database error',
                                    warnings: [],
                                    assignedStatus: null,
                                    statusChanged: false,
                                    changeDetails: []
                                });
                                batchFailed++;
                            });
                        }
                    }
                }

                // Create latest records for frontend
                const latestRecords = createLatestRecordsUpdate(validRecords, {
                    batchCreated,
                    batchUpdated,
                    batchFailed,
                    batchNoChangesSkipped
                }, existingRecordsMap);

                return {
                    batchFailedRecords,
                    batchFailed,
                    batchCreated,
                    batchUpdated,
                    batchNoChangesSkipped,
                    batchStatusUpdates,
                    latestRecords
                };
            }

            return {
                batchFailedRecords,
                batchFailed,
                batchCreated: 0,
                batchUpdated: 0,
                batchNoChangesSkipped: 0,
                batchStatusUpdates: 0,
                latestRecords: []
            };
        };

        // Process batches
        const batchPromises = [];
        for (let batchIndex = 0; batchIndex < response.batchProgress.totalBatches; batchIndex++) {
            const startIdx = batchIndex * BATCH_SIZE;
            const endIdx = Math.min(startIdx + BATCH_SIZE, jsonData.length);
            const batch = jsonData.slice(startIdx, endIdx);

            response.batchProgress.currentBatch = batchIndex + 1;
            response.batchProgress.currentBatchRecords = batch.length;

            // Send batch progress update
            res.write(JSON.stringify({
                type: 'progress',
                batchProgress: response.batchProgress
            }) + '\n');

            // Control parallel batch processing
            if (batchPromises.length >= PARALLEL_BATCHES) {
                const completedBatch = await Promise.race(batchPromises);
                const promiseIndex = batchPromises.indexOf(completedBatch);
                batchPromises.splice(promiseIndex, 1);

                // Update response with completed batch results
                const batchResult = await completedBatch;
                
                response.processedRecords += batch.length;
                response.failedRecords += batchResult.batchFailed;
                response.summary.created += batchResult.batchCreated;
                response.summary.updated += batchResult.batchUpdated;
                response.summary.failed += batchResult.batchFailed;
                response.summary.noChangesSkipped += batchResult.batchNoChangesSkipped;
                response.summary.skippedTotal += batchResult.batchNoChangesSkipped;
                response.summary.statusUpdates.total += batchResult.batchStatusUpdates;
                
                // Add failed records to results
                response.results.push(...batchResult.batchFailedRecords);

                // Count file duplicates
                response.summary.duplicatesInFile += batchResult.batchFailedRecords.filter(
                    r => r.error && r.error.includes('Duplicate Customer Code in file')
                ).length;

                // Send batch completion update
                res.write(JSON.stringify({
                    type: 'batch_completed',
                    batchCompleted: true,
                    batchSummary: {
                        created: batchResult.batchCreated,
                        updated: batchResult.batchUpdated,
                        failed: batchResult.batchFailed,
                        skipped: batchResult.batchNoChangesSkipped
                    },
                    summary: response.summary,
                    latestRecords: batchResult.latestRecords,
                    processedRecords: response.processedRecords,
                    failedRecords: response.failedRecords,
                    batchProgress: response.batchProgress
                }) + '\n');
            }

            batchPromises.push(processBatch(batch, batchIndex));
        }

        // Process remaining batches
        while (batchPromises.length > 0) {
            const completedBatch = await batchPromises.shift();
            const batchResult = await completedBatch;
            
            response.processedRecords += BATCH_SIZE;
            response.failedRecords += batchResult.batchFailed;
            response.summary.created += batchResult.batchCreated;
            response.summary.updated += batchResult.batchUpdated;
            response.summary.failed += batchResult.batchFailed;
            response.summary.noChangesSkipped += batchResult.batchNoChangesSkipped;
            response.summary.skippedTotal += batchResult.batchNoChangesSkipped;
            response.summary.statusUpdates.total += batchResult.batchStatusUpdates;
            
            response.results.push(...batchResult.batchFailedRecords);

            response.summary.duplicatesInFile += batchResult.batchFailedRecords.filter(
                r => r.error && r.error.includes('Duplicate Customer Code in file')
            ).length;

            res.write(JSON.stringify({
                type: 'batch_completed',
                batchCompleted: true,
                batchSummary: {
                    created: batchResult.batchCreated,
                    updated: batchResult.batchUpdated,
                    failed: batchResult.batchFailed,
                    skipped: batchResult.batchNoChangesSkipped
                },
                summary: response.summary,
                latestRecords: batchResult.latestRecords,
                processedRecords: response.processedRecords,
                failedRecords: response.failedRecords,
                batchProgress: response.batchProgress
            }) + '\n');
        }

        // Final completion
        response.status = 'completed';
        response.endTime = new Date();
        response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;
        response.successfulRecords = response.summary.created + response.summary.updated;

        response.message = `Processing completed successfully. Created: ${response.summary.created}, Updated: ${response.summary.updated}, Failed: ${response.summary.failed}, File Duplicates: ${response.summary.duplicatesInFile}, Existing Records: ${response.summary.existingRecords}, No Changes Skipped: ${response.summary.noChangesSkipped}, Total Skipped: ${response.summary.skippedTotal}, Status Updates: ${response.summary.statusUpdates.total}`;

        // Send final response
        res.write(JSON.stringify({
            status: response.status,
            startTime: response.startTime,
            totalRecords: response.totalRecords,
            processedRecords: response.totalRecords, // Set to total since all are processed
            successfulRecords: response.successfulRecords,
            failedRecords: response.failedRecords,
            results: response.results,
            summary: response.summary,
            headerMapping: response.headerMapping,
            errors: response.errors,
            warnings: response.warnings,
            batchProgress: response.batchProgress,
            endTime: response.endTime,
            duration: response.duration,
            message: response.message
        }) + '\n');

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
