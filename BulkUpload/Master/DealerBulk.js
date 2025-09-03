const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const Dealer = require('../../Model/MasterSchema/DealerSchema');

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

// Field mappings for Dealer schema - comprehensive variations
const FIELD_MAPPINGS = {
    'name': new Set([
        'name', 'dealername', 'dealer_name', 'dealer-name',
        'companyname', 'company_name', 'company-name', 'firm',
        'business_name', 'businessname', 'organization'
    ]),
    'dealercode': new Set([
        'dealercode', 'dealer_code', 'dealer-code', 'code',
        'dealerno', 'dealer_no', 'dealer-no', 'id',
        'dealerid', 'dealer_id', 'dealer-id'
    ]),
    'email': new Set([
        'email', 'emailid', 'email_id', 'email-id',
        'emailaddress', 'email_address', 'email-address',
        'mail', 'mailid', 'contact_email'
    ]),
    'state': new Set([
        'state', 'states', 'statename', 'state_name',
        'state-name', 'location_state', 'area_state',
        'region', 'province'
    ]),
    'city': new Set([
        'city', 'cities', 'cityname', 'city_name',
        'city-name', 'location_city', 'area_city',
        'district', 'town'
    ]),
    'address': new Set([
        'address', 'fulladdress', 'full_address', 'full-address',
        'location', 'dealeraddress', 'dealer_address',
        'street_address', 'streetaddress', 'complete_address'
    ]),
    'pincode': new Set([
        'pincode', 'pin_code', 'pin-code', 'zip',
        'zipcode', 'zip_code', 'zip-code', 'postal',
        'postalcode', 'postal_code', 'postal-code'
    ]),
    'personresponsible': new Set([
        'personresponsible', 'person_responsible', 'person-responsible',
        'responsible_person', 'responsibleperson', 'contact_person',
        'contactperson', 'manager', 'incharge', 'representative'
    ]),
    'employeeid': new Set([
        'employeeid', 'employee_id', 'employee-id', 'empid',
        'emp_id', 'emp-id', 'staffid', 'staff_id',
        'personnel_id', 'personnelid'
    ]),
    'status': new Set([
        'status', 'record_status', 'dealer_status', 'current_status',
        'active_status', 'state', 'condition', 'availability'
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

// Helper function to parse array fields (state, city, personresponsible)
function parseArrayField(value, fieldType = 'string') {
    if (!value || value.trim() === '') return [];
    
    // Handle different separators
    const separators = [',', ';', '|', '\n', '\r\n'];
    let items = [value];
    
    // Try each separator to split the value
    for (const separator of separators) {
        if (value.includes(separator)) {
            items = value.split(separator);
            break;
        }
    }
    
    // Clean and filter items
    items = items
        .map(item => item.trim())
        .filter(item => item !== '' && item !== 'undefined' && item !== 'null')
        .map(item => item.replace(MULTISPACE_REGEX, ' '));
    
    return items.length > 0 ? items : [];
}

// Helper function to parse person responsible field
function parsePersonResponsible(nameValue, employeeIdValue) {
    const names = parseArrayField(nameValue);
    const employeeIds = parseArrayField(employeeIdValue);
    
    const personResponsible = [];
    
    // Match names with employee IDs
    for (let i = 0; i < Math.max(names.length, employeeIds.length); i++) {
        const name = names[i] || `Person ${i + 1}`;
        const employeeid = employeeIds[i] || `EMP${String(i + 1).padStart(3, '0')}`;
        
        personResponsible.push({
            name: name,
            employeeid: employeeid
        });
    }
    
    return personResponsible;
}

// Function to check for changes between existing and new records
function checkForChanges(existingRecord, newRecord, providedFields) {
    const changes = [];
    let hasChanges = false;

    for (const field of providedFields) {
        let oldValue = existingRecord[field];
        let newValue = newRecord[field];
        
        // Handle array fields comparison
        if (Array.isArray(oldValue) && Array.isArray(newValue)) {
            const oldSorted = JSON.stringify(oldValue.sort());
            const newSorted = JSON.stringify(newValue.sort());
            if (oldSorted !== newSorted) {
                hasChanges = true;
                changes.push({
                    field,
                    oldValue: oldValue.join(', '),
                    newValue: newValue.join(', ')
                });
            }
        } else {
            // Handle regular fields
            oldValue = oldValue || '';
            newValue = newValue || '';
            
            if (oldValue !== newValue) {
                hasChanges = true;
                changes.push({
                    field,
                    oldValue,
                    newValue
                });
            }
        }
    }

    return {
        hasChanges,
        changeDetails: changes
    };
}

// Generate unique identifier for Dealer records (using dealercode as unique key)
function generateUniqueKey(record) {
    return `${record.dealercode}`.toLowerCase();
}

// Record validation to match Dealer schema requirements
function validateRecord(record, headerMapping) {
    const cleanedRecord = {};
    const providedFields = [];
    const errors = [];

    // Track if we have person responsible data
    let hasPersonName = false;
    let hasEmployeeId = false;
    let personNames = '';
    let employeeIds = '';

    // Map headers to schema fields
    for (const [originalHeader, schemaField] of Object.entries(headerMapping)) {
        if (record[originalHeader] === undefined || record[originalHeader] === null) continue;

        const value = String(record[originalHeader]).trim();
        if (value === '' || value === 'undefined' || value === 'null') continue;

        // Handle different field types based on schema
        if (schemaField === 'state' || schemaField === 'city') {
            const arrayValue = parseArrayField(value);
            if (arrayValue.length > 0) {
                cleanedRecord[schemaField] = arrayValue;
                providedFields.push(schemaField);
            }
        } else if (schemaField === 'personresponsible') {
            personNames = value;
            hasPersonName = true;
        } else if (schemaField === 'employeeid') {
            employeeIds = value;
            hasEmployeeId = true;
        } else if (schemaField === 'status') {
            cleanedRecord['status'] = value.replace(MULTISPACE_REGEX, ' ').trim();
            providedFields.push(schemaField);
        } else {
            // String fields
            cleanedRecord[schemaField] = value.replace(MULTISPACE_REGEX, ' ').trim();
            providedFields.push(schemaField);
        }
    }

    // Handle person responsible if we have the data
    if (hasPersonName || hasEmployeeId) {
        const personResponsible = parsePersonResponsible(personNames, employeeIds);
        if (personResponsible.length > 0) {
            cleanedRecord['personresponsible'] = personResponsible;
            providedFields.push('personresponsible');
        }
    }

    // Required fields validation
    const requiredFields = ['name', 'dealercode', 'email', 'state', 'city', 'address', 'pincode'];
    for (const field of requiredFields) {
        if (!cleanedRecord[field] || 
            (Array.isArray(cleanedRecord[field]) && cleanedRecord[field].length === 0)) {
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
        'dealercode': 50,
        'email': 100,
        'address': 500,
        'pincode': 10,
        'status': 50
    };

    for (const [field, maxLength] of Object.entries(fieldLimits)) {
        if (cleanedRecord[field] && typeof cleanedRecord[field] === 'string' && cleanedRecord[field].length > maxLength) {
            errors.push(`${field} too long (max ${maxLength} characters)`);
        }
    }

    // Email validation
    // if (cleanedRecord.email) {
    //     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    //     if (!emailRegex.test(cleanedRecord.email)) {
    //         errors.push('Invalid email format');
    //     }
    // }

    // Pincode validation
    // if (cleanedRecord.pincode) {
    //     const pincodeRegex = /^[0-9]{6}$/;
    //     if (!pincodeRegex.test(cleanedRecord.pincode)) {
    //         errors.push('Pincode must be 6 digits');
    //     }
    // }

    // Set default values
    if (!cleanedRecord.status || cleanedRecord.status.trim() === '') {
        cleanedRecord.status = 'Active';
    }

    // Set timestamps
    const now = new Date();
    if (!providedFields.includes('createdat')) {
        cleanedRecord.createdAt = now;
    }
    cleanedRecord.modifiedAt = now;

    // Ensure person responsible has at least one entry if not provided
    if (!cleanedRecord.personresponsible || cleanedRecord.personresponsible.length === 0) {
        cleanedRecord.personresponsible = [{
            name: 'Default Contact',
            employeeid: 'DEFAULT001'
        }];
    }

    return { cleanedRecord, errors, providedFields };
}

// MAIN ROUTE - Dealer Bulk Upload
router.post('/dealer-bulk-upload', upload.single('file'), async (req, res) => {
    const BATCH_SIZE = 1000; // Reduced batch size for complex nested data
    const PARALLEL_BATCHES = 2; // Reduced parallelism for safety
    const BULK_WRITE_BATCH_SIZE = 200; // Smaller bulk write batches

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

        // Check for required fields
        const requiredFields = ['name', 'dealercode', 'email', 'state', 'city', 'address', 'pincode'];
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
                    dealercode: '',
                    email: '',
                    state: [],
                    city: [],
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
                    recordResult.dealercode = cleanedRecord.dealercode || 'Unknown';
                    recordResult.email = cleanedRecord.email || 'N/A';
                    recordResult.state = cleanedRecord.state || [];
                    recordResult.city = cleanedRecord.city || [];
                    recordResult.assignedStatus = cleanedRecord.status;

                    if (errors.length > 0) {
                        recordResult.status = 'Failed';
                        recordResult.error = errors.join(', ');
                        recordResult.action = 'Validation failed';
                        batchResults.push(recordResult);
                        batchFailed++;
                        continue;
                    }

                    // Generate unique key for duplicate checking (using dealercode)
                    const uniqueKey = generateUniqueKey(cleanedRecord);

                    // Check for duplicates within the file
                    if (processedUniqueKeys.has(uniqueKey)) {
                        recordResult.status = 'Skipped';
                        recordResult.error = 'Duplicate Dealer Code in file';
                        recordResult.action = 'Skipped due to file duplicate';
                        recordResult.warnings.push('Dealer Code already processed in this file');
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
                // Find existing records in bulk using dealercode
                const dealerCodes = validRecords.map(r => r.cleanedRecord.dealercode);
                const existingRecords = await Dealer.find({
                    dealercode: { $in: dealerCodes }
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
                const executeBulkWrite = async (operations) => {
                    for (let i = 0; i < operations.length; i += BULK_WRITE_BATCH_SIZE) {
                        const chunk = operations.slice(i, i + BULK_WRITE_BATCH_SIZE);
                        try {
                            await Dealer.bulkWrite(chunk, { ordered: false });
                        } catch (bulkError) {
                            // Handle bulk errors by marking affected records as failed
                            if (bulkError.writeErrors) {
                                bulkError.writeErrors.forEach(error => {
                                    const failedRecord = batchResults.find(r => {
                                        const errorDoc = error.op?.insertOne?.document || error.op?.updateOne?.update?.$set;
                                        return errorDoc && r.dealercode === errorDoc.dealercode;
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
                };

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
                    r => r.status === 'Skipped' && r.error === 'Duplicate Dealer Code in file'
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
                r => r.status === 'Skipped' && r.error === 'Duplicate Dealer Code in file'
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
        console.error('Dealer bulk upload error:', error);
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
