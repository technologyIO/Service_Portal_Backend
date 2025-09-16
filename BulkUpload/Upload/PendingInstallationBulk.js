const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { parse, isValid, parseISO, format } = require('date-fns');
const PendingInstallation = require('../../Model/UploadSchema/PendingInstallationSchema');

// Optimized: Pre-compiled regex patterns
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]/g;
const MULTISPACE_REGEX = /\s+/g;
const ENCODING_ISSUES_REGEX = /[�â€™â€œâ€â€"â€'Â\u00A0\u2019\u201C\u201D\u2013\u2014\u2026]/g;

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

// FIXED: Updated field mappings to handle normalized field names correctly
const FIELD_MAPPINGS = {
    'invoiceno': new Set(['invoiceno', 'invoice_no', 'invoicenumber', 'invoice_number', 'billno', 'bill_no', 'billdoc', 'bill.doc.', 'billdoc']),
    'invoicedate': new Set(['invoicedate', 'invoice_date', 'billdate', 'bill_date', 'date', 'billing date', 'billingdate']),
    'distchnl': new Set(['distchnl', 'dist_chnl', 'distributionchannel', 'distribution_channel', 'channel', 'dchl']),
    'customerid': new Set(['customerid', 'customer_id', 'custid', 'cust_id', 'customercode', 'customer_code', 'sold-to pt', 'soldtopt', 'soldto', 'soldtopt']),
    'customername1': new Set(['customername1', 'customer_name1', 'customername', 'customer_name', 'name1', 'name 1', 'name1']),
    'customername2': new Set(['customername2', 'customer_name2', 'name2', 'hospitalname', 'hospital_name', 'name 2', 'name2']),
    'customercity': new Set(['customercity', 'customer_city', 'city']),
    'customerpostalcode': new Set(['customerpostalcode', 'customer_postal_code', 'postalcode', 'postal_code', 'pincode', 'zip', 'postalcode']),
    'material': new Set(['material', 'materialcode', 'material_code', 'productcode', 'product_code', 'partno', 'part_no']),
    'description': new Set(['description', 'materialdescription', 'material_description', 'productdescription', 'product_description', 'desc']),
    'serialnumber': new Set(['serialnumber', 'serial_number', 'serialno', 'serial_no', 'sno', 'serial number', 'serialnumber']),
    'salesdist': new Set(['salesdist', 'sales_dist', 'salesdistrict', 'sales_district', 'diso']),
    'salesoff': new Set(['salesoff', 'sales_off', 'salesoffice', 'sales_office', 'soff.', 'soff', 'sofficer']),
    'customercountry': new Set(['customercountry', 'customer_country', 'country', 'cty']),
    'customerregion': new Set(['customerregion', 'customer_region', 'region', 'rg']),
    'currentcustomerid': new Set(['currentcustomerid', 'current_customer_id', 'currentcustid', 'current_cust_id', 'customer']),
    'currentcustomername1': new Set(['currentcustomername1', 'current_customer_name1', 'currentcustomername', 'current_customer_name', 'name 1', 'name1']),
    'currentcustomername2': new Set(['currentcustomername2', 'current_customer_name2', 'currenthospitalname', 'current_hospital_name', 'name 2', 'name2']),
    'currentcustomercity': new Set(['currentcustomercity', 'current_customer_city', 'currentcity', 'current_city', 'city']),
    'currentcustomerregion': new Set(['currentcustomerregion', 'current_customer_region', 'currentregion', 'current_region', 'rg']),
    'currentcustomerpostalcode': new Set(['currentcustomerpostalcode', 'current_customer_postal_code', 'currentpostalcode', 'current_postal_code', 'postalcode']),
    'currentcustomercountry': new Set(['currentcustomercountry', 'current_customer_country', 'currentcountry', 'current_country', 'cty']),
    'mtl_grp4': new Set(['mtlgrp4', 'mtl_grp4', 'materialgroup4', 'material_group4', 'mtlgroup4', 'mtl_group4', 'mg 4', 'mg4', 'materialgrp4']),
    'key': new Set(['key', 'keyfield', 'key_field', 'id', 'generated code', 'generatedcode']),
    'palnumber': new Set(['palnumber', 'pal_number', 'pal', 'palletno', 'pallet_no', 'pal number', 'palnumber']),
    'status': new Set(['status', 'record_status', 'installation_status', 'pending_status', 'current_status', 'equipment_status'])
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
        const originalHeader = header.toLowerCase().trim();

        // Skip if we've already mapped this exact header
        if (seenFields.has(normalizedHeader)) continue;
        seenFields.add(normalizedHeader);

        // Find the first matching schema field - check both normalized and original
        for (const [schemaField, variations] of Object.entries(FIELD_MAPPINGS)) {
            if (variations.has(normalizedHeader) || variations.has(originalHeader)) {
                mappedHeaders[header] = schemaField;
                console.log(`Mapped header "${header}" (normalized: "${normalizedHeader}") to "${schemaField}"`);
                break; // Move to next header once we find a match
            }
        }
    }

    return mappedHeaders;
}

// Optimized text cleaning with memoization
const cleanedTextCache = new Map();
function cleanText(text) {
    if (!text || typeof text !== 'string') return text;
    if (cleanedTextCache.has(text)) return cleanedTextCache.get(text);

    const cleaned = text
        .replace(ENCODING_ISSUES_REGEX, ' ')
        .replace(MULTISPACE_REGEX, ' ')
        .trim();

    cleanedTextCache.set(text, cleaned);
    return cleaned;
}

// ENHANCED: Comprehensive date parsing function
const dateCache = new Map();
function parseUniversalDate(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date && !isNaN(dateInput)) return dateInput;

    const cacheKey = JSON.stringify(dateInput);
    if (dateCache.has(cacheKey)) return dateCache.get(cacheKey);

    let result = null;

    try {
        // Handle Excel serial date numbers
        if (typeof dateInput === 'number' && dateInput > 25000 && dateInput < 100000) {
            try {
                const excelDate = XLSX.SSF.parse_date_code(dateInput);
                if (excelDate && excelDate.y && excelDate.m && excelDate.d) {
                    result = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
                }
            } catch (e) {
                console.log('Excel date parsing failed:', e.message);
            }
        }

        // If Excel parsing failed or input is string, try string parsing
        if (!result && (typeof dateInput === 'string' || typeof dateInput === 'number')) {
            const dateString = String(dateInput).trim();
            
            // Skip empty or obviously invalid strings
            if (!dateString || dateString === '0' || dateString.length < 6) {
                dateCache.set(cacheKey, null);
                return null;
            }

            // Try ISO date format first
            try {
                const isoDate = parseISO(dateString);
                if (isValid(isoDate)) {
                    result = isoDate;
                }
            } catch (e) {
                // ISO parsing failed, continue with other formats
            }

            // If ISO failed, try common date formats
            if (!result) {
                const formats = [
                    // DD/MM/YYYY formats
                    'dd/MM/yyyy', 'dd/MM/yy', 'd/M/yyyy', 'd/M/yy',
                    'dd-MM-yyyy', 'dd-MM-yy', 'd-M-yyyy', 'd-M-yy',
                    'dd.MM.yyyy', 'dd.MM.yy', 'd.M.yyyy', 'd.M.yy',
                    
                    // MM/DD/YYYY formats
                    'MM/dd/yyyy', 'MM/dd/yy', 'M/d/yyyy', 'M/d/yy',
                    'MM-dd-yyyy', 'MM-dd-yy', 'M-d-yyyy', 'M-d-yy',
                    'MM.dd.yyyy', 'MM.dd.yy', 'M.d.yyyy', 'M.d.yy',
                    
                    // YYYY/MM/DD formats
                    'yyyy/MM/dd', 'yyyy/M/d', 'yy/MM/dd', 'yy/M/d',
                    'yyyy-MM-dd', 'yyyy-M-d', 'yy-MM-dd', 'yy-M-d',
                    'yyyy.MM.dd', 'yyyy.M.d', 'yy.MM.dd', 'yy.M.d',
                    
                    // Additional formats
                    'dd MMM yyyy', 'dd-MMM-yyyy', 'dd.MMM.yyyy',
                    'MMM dd yyyy', 'MMM-dd-yyyy', 'MMM.dd.yyyy',
                    'yyyy MMM dd', 'yyyy-MMM-dd', 'yyyy.MMM.dd',
                    
                    // Compact formats
                    'ddMMyyyy', 'MMddyyyy', 'yyyyMMdd',
                    'ddMMyy', 'MMddyy', 'yyMMdd'
                ];

                for (const formatString of formats) {
                    try {
                        const parsedDate = parse(dateString, formatString, new Date());
                        if (isValid(parsedDate)) {
                            // Validate year range (1900-2100)
                            const year = parsedDate.getFullYear();
                            if (year >= 1900 && year <= 2100) {
                                result = parsedDate;
                                break;
                            }
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            // Last resort: try JavaScript Date constructor
            if (!result) {
                try {
                    const jsDate = new Date(dateString);
                    if (isValid(jsDate) && !isNaN(jsDate.getTime())) {
                        const year = jsDate.getFullYear();
                        if (year >= 1900 && year <= 2100) {
                            result = jsDate;
                        }
                    }
                } catch (e) {
                    // Final fallback failed
                }
            }
        }

        // Validate final result
        if (result && (isNaN(result.getTime()) || result.getFullYear() < 1900 || result.getFullYear() > 2100)) {
            result = null;
        }

    } catch (error) {
        console.log('Date parsing error:', error.message, 'for input:', dateInput);
        result = null;
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
            dateNF: 'dd/mm/yyyy',
            codepage: 65001 // UTF-8
        });
        const sheetName = workbook.SheetNames[0];
        return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
            defval: '',
            raw: false,
            dateNF: 'dd/mm/yyyy'
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
                strict: false,
                skipLines: 0,
                skipEmptyLines: true
            }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);

        stream.on('error', () => stream.destroy());
    });
}

// Helper function to get file extension
function getFileExtension(filename) {
    return filename.toLowerCase().split('.').pop();
}

// Optimized record validation with early exits - UPDATED with status handling
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
        if (schemaField === 'invoicedate') {
            const parsedDate = parseUniversalDate(record[originalHeader]);
            if (parsedDate) {
                cleanedRecord[schemaField] = parsedDate;
                providedFields.push(schemaField);
            } else {
                console.log(`Warning: Could not parse date "${record[originalHeader]}" for field ${originalHeader}`);
            }
        } else {
            cleanedRecord[schemaField] = cleanText(value);
            providedFields.push(schemaField);
        }
    }

    // Required field validation - status is NOT required
    const requiredFields = [
        'invoiceno', 'distchnl', 'customerid', 'material',
        'description', 'serialnumber', 'salesdist', 'salesoff',
        'currentcustomerid', 'mtl_grp4'
    ];

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
    if (cleanedRecord.invoiceno && cleanedRecord.invoiceno.length > 50) {
        errors.push('Invoice No too long (max 50 characters)');
    }
    if (cleanedRecord.serialnumber && cleanedRecord.serialnumber.length > 50) {
        errors.push('Serial Number too long (max 50 characters)');
    }

    // Set default status only if not provided
    if (!cleanedRecord.status || cleanedRecord.status.trim() === '') {
        cleanedRecord.status = 'Active';
    }

    return { cleanedRecord, errors, providedFields };
}

// Optimized: Inline simple functions - UPDATED with status field
function checkForChanges(existingRecord, newRecord, providedFields) {
    let hasAnyChange = false;
    const changeDetails = [];

    for (const field of providedFields) {
        let existingValue = '';
        let newValue = '';

        // Special handling for dates
        if (field === 'invoicedate') {
            existingValue = existingRecord[field] ? format(new Date(existingRecord[field]), 'dd/MM/yyyy') : '';
            newValue = newRecord[field] ? format(new Date(newRecord[field]), 'dd/MM/yyyy') : '';
        } else {
            existingValue = existingRecord[field] ? String(existingRecord[field]).trim() : '';
            newValue = newRecord[field] ? String(newRecord[field]).trim() : '';
        }

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

// MAIN ROUTE - Optimized with parallel processing and bulk operations
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
    const BATCH_SIZE = 2000; // Increased batch size for better performance
    const PARALLEL_BATCHES = 3; // Process multiple batches in parallel
    const BULK_WRITE_BATCH_SIZE = 500; // MongoDB bulk write batch size

    // Initialize response object with optimized structure - UPDATED with status tracking
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
        const requiredSchemaFields = [
            'invoiceno', 'distchnl', 'customerid', 'material',
            'description', 'serialnumber', 'salesdist', 'salesoff',
            'currentcustomerid', 'mtl_grp4'
        ];

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
            response.warnings.push('Status field not found in file. Default status "Pending" will be assigned to new records');
        }

        // Send initial response
        res.write(JSON.stringify(response) + '\n');

        const processedSerialNumbers = new Set();
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
                    invoiceno: '',
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
                    recordResult.invoiceno = cleanedRecord.invoiceno || 'Unknown';
                    recordResult.serialnumber = cleanedRecord.serialnumber || 'Unknown';
                    recordResult.assignedStatus = cleanedRecord.status;

                    if (errors.length > 0) {
                        recordResult.status = 'Failed';
                        recordResult.error = errors.join(', ');
                        recordResult.action = 'Validation failed';
                        batchResults.push(recordResult);
                        batchFailed++;
                        continue;
                    }

                    // Check for duplicates within the file
                    if (processedSerialNumbers.has(cleanedRecord.serialnumber)) {
                        recordResult.status = 'Skipped';
                        recordResult.error = 'Duplicate Serial Number in file';
                        recordResult.action = 'Skipped due to file duplicate';
                        recordResult.warnings.push('Serial Number already processed in this file');
                        batchResults.push(recordResult);
                        batchSkipped++;
                        continue;
                    }

                    processedSerialNumbers.add(cleanedRecord.serialnumber);
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
                const serialNumbers = validRecords.map(r => r.cleanedRecord.serialnumber);
                const existingRecords = await PendingInstallation.find({
                    serialnumber: { $in: serialNumbers }
                }).lean();

                const existingRecordsMap = new Map();
                existingRecords.forEach(rec => {
                    existingRecordsMap.set(rec.serialnumber, rec);
                });

                // Prepare bulk operations
                const bulkCreateOps = [];
                const bulkUpdateOps = [];
                const now = new Date();

                for (const { cleanedRecord, recordResult, providedFields } of validRecords) {
                    const existingRecord = existingRecordsMap.get(cleanedRecord.serialnumber);

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
                                    filter: { serialnumber: cleanedRecord.serialnumber },
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
                            await PendingInstallation.bulkWrite(chunk, { ordered: false });
                        } catch (bulkError) {
                            console.error(`Bulk ${operationType} error:`, bulkError);
                            // Handle bulk errors by marking affected records as failed
                            if (bulkError.writeErrors) {
                                bulkError.writeErrors.forEach(error => {
                                    const failedRecord = batchResults.find(r => {
                                        const serialFromOp = error.op?.serialnumber ||
                                            error.op?.insertOne?.document?.serialnumber ||
                                            error.op?.updateOne?.filter?.serialnumber;
                                        return r.serialnumber === serialFromOp;
                                    });
                                    if (failedRecord) {
                                        failedRecord.status = 'Failed';
                                        failedRecord.action = `Bulk ${operationType} failed`;
                                        failedRecord.error = error.errmsg || error.message;
                                        batchFailed++;
                                        if (failedRecord.status === 'Created') batchCreated--;
                                        if (failedRecord.status === 'Updated') batchUpdated--;
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
                type: 'progress',
                batchProgress: response.batchProgress
            }) + '\n');

            // Process batch with controlled parallelism
            if (batchPromises.length >= PARALLEL_BATCHES) {
                const completedBatch = await Promise.race(batchPromises);
                const completedIndex = batchPromises.indexOf(completedBatch);
                batchPromises.splice(completedIndex, 1);

                // Update response with completed batch results
                response.processedRecords += completedBatch.batchResults.length;
                response.successfulRecords += completedBatch.batchCreated + completedBatch.batchUpdated;
                response.failedRecords += completedBatch.batchFailed;
                response.summary.created += completedBatch.batchCreated;
                response.summary.updated += completedBatch.batchUpdated;
                response.summary.failed += completedBatch.batchFailed;
                response.summary.skippedTotal += completedBatch.batchSkipped;
                response.summary.duplicatesInFile += completedBatch.batchResults.filter(
                    r => r.status === 'Skipped' && r.error === 'Duplicate Serial Number in file'
                ).length;
                response.summary.noChangesSkipped += completedBatch.batchResults.filter(
                    r => r.status === 'Skipped' && r.action === 'No changes detected'
                ).length;

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

                res.write(JSON.stringify({
                    type: 'batch_completed',
                    batchCompleted: true,
                    batchSummary: {
                        created: completedBatch.batchCreated,
                        updated: completedBatch.batchUpdated,
                        failed: completedBatch.batchFailed,
                        skipped: completedBatch.batchSkipped
                    },
                    batchProgress: response.batchProgress,
                    summary: response.summary,
                    latestRecords: completedBatch.batchResults.slice(-3)
                }) + '\n');
            }

            batchPromises.push(processBatch(batch, batchIndex));
        }

        // Process remaining batches
        const remainingBatches = await Promise.all(batchPromises);
        for (const completedBatch of remainingBatches) {
            // Update response with completed batch results
            response.processedRecords += completedBatch.batchResults.length;
            response.successfulRecords += completedBatch.batchCreated + completedBatch.batchUpdated;
            response.failedRecords += completedBatch.batchFailed;
            response.summary.created += completedBatch.batchCreated;
            response.summary.updated += completedBatch.batchUpdated;
            response.summary.failed += completedBatch.batchFailed;
            response.summary.skippedTotal += completedBatch.batchSkipped;
            response.summary.duplicatesInFile += completedBatch.batchResults.filter(
                r => r.status === 'Skipped' && r.error === 'Duplicate Serial Number in file'
            ).length;
            response.summary.noChangesSkipped += completedBatch.batchResults.filter(
                r => r.status === 'Skipped' && r.action === 'No changes detected'
            ).length;

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

            res.write(JSON.stringify({
                type: 'batch_completed',
                batchCompleted: true,
                batchSummary: {
                    created: completedBatch.batchCreated,
                    updated: completedBatch.batchUpdated,
                    failed: completedBatch.batchFailed,
                    skipped: completedBatch.batchSkipped
                },
                summary: response.summary,
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
        console.error('Pending Installation bulk upload error:', error);
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
