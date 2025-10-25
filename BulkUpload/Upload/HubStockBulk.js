const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const path = require('path');
const HubStock = require('../../Model/UploadSchema/HubStockSchema');

// Optimized: Pre-compiled regex patterns
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]/g;
const MULTISPACE_REGEX = /\s+/g;

// Enhanced file type detection
function getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
}

function isValidFileType(file) {
    const validMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/excel', // .xls (alternative)
        'text/csv', // .csv
        'application/csv', // .csv (alternative)
        'text/plain', // .csv (sometimes detected as plain text)
        'application/octet-stream' // Generic binary (fallback)
    ];

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExt = getFileExtension(file.originalname);

    // Check MIME type first
    const mimeTypeValid = validMimeTypes.includes(file.mimetype);

    // Check extension as fallback
    const extensionValid = validExtensions.includes(fileExt);

    // Accept file if either MIME type or extension is valid
    return mimeTypeValid || extensionValid;
}

// Memory storage with enhanced settings
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        console.log('File details:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            extension: getFileExtension(file.originalname)
        });

        if (isValidFileType(file)) {
            cb(null, true);
        } else {
            const fileExt = getFileExtension(file.originalname);
            cb(new Error(`Unsupported file type. File: ${file.originalname}, MIME: ${file.mimetype}, Extension: ${fileExt}. Only Excel (.xlsx, .xls) and CSV files are allowed`), false);
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Optimized: Predefined field mappings for faster access
const FIELD_MAPPINGS = {
    'materialcode': new Set(['materialcode', 'material_code', 'partno', 'part_no', 'code', 'item_code', 'product_code', 'material']),
    'materialdescription': new Set(['materialdescription', 'material_description', 'description', 'desc', 'product_description', 'item_description', 'material_desc', 'material description']),
    'quantity': new Set(['quantity', 'qty', 'stock', 'stockquantity', 'stock_quantity', 'available_quantity', 'availablequantity', 'amount', 'unrestricted']),
    'storagelocation': new Set(['storagelocation', 'storage_location', 'location', 'warehouse', 'depot', 'storagearea', 'storage_area', 'bin', 'zone', 'storage location']),
    'status': new Set(['status', 'state', 'condition', 'active', 'inactive'])
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

// Enhanced Excel parsing with better error handling
function parseExcelFile(buffer, originalname) {
    try {
        console.log('Parsing Excel file:', originalname);
        const workbook = XLSX.read(buffer, {
            type: 'buffer',
            cellDates: true,
            cellStyles: false, // Disable styles for better performance
            cellHTML: false,   // Disable HTML for better performance
            raw: false         // Convert values to strings
        });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('No sheets found in Excel file');
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
            throw new Error(`Sheet "${sheetName}" not found`);
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            defval: '',
            raw: false,
            header: 1 // Get array of arrays first
        });

        if (jsonData.length === 0) {
            throw new Error('No data found in Excel sheet');
        }

        // Convert array of arrays to array of objects
        const headers = jsonData[0];
        const dataRows = jsonData.slice(1);

        return dataRows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index] || '';
            });
            return obj;
        });

    } catch (error) {
        console.error('Excel parsing error:', error);
        throw new Error(`Excel parsing error: ${error.message}`);
    }
}

// Enhanced CSV parsing
function parseCSVFile(buffer, originalname) {
    return new Promise((resolve, reject) => {
        console.log('Parsing CSV file:', originalname);
        const results = [];

        try {
            const csvString = buffer.toString('utf8');

            if (!csvString.trim()) {
                reject(new Error('CSV file is empty'));
                return;
            }

            const stream = Readable.from(csvString)
                .pipe(csv({
                    mapValues: ({ value }) => value ? value.trim() : '',
                    strict: false, // Be more lenient with CSV parsing
                    skipLines: 0,
                    skipEmptyLines: true,
                    headers: true // Automatically detect headers
                }))
                .on('data', (data) => {
                    // Filter out completely empty rows
                    const hasData = Object.values(data).some(val => val && val.trim());
                    if (hasData) {
                        results.push(data);
                    }
                })
                .on('end', () => {
                    console.log(`CSV parsing completed. Found ${results.length} records`);
                    resolve(results);
                })
                .on('error', (error) => {
                    console.error('CSV parsing error:', error);
                    reject(new Error(`CSV parsing error: ${error.message}`));
                });

            // Set timeout for CSV parsing
            setTimeout(() => {
                if (!stream.destroyed) {
                    stream.destroy();
                    reject(new Error('CSV parsing timeout'));
                }
            }, 30000); // 30 second timeout

        } catch (error) {
            console.error('CSV setup error:', error);
            reject(new Error(`CSV setup error: ${error.message}`));
        }
    });
}

// Enhanced file type detection and parsing
async function parseUploadedFile(file) {
    const fileExt = getFileExtension(file.originalname);
    const fileName = file.originalname.toLowerCase();

    console.log('Processing file:', {
        name: file.originalname,
        size: file.buffer.length,
        mimetype: file.mimetype,
        extension: fileExt
    });

    try {
        // Detect file type by extension primarily, then by MIME type
        if (fileExt === '.csv' || fileName.includes('.csv')) {
            return await parseCSVFile(file.buffer, file.originalname);
        } else if (fileExt === '.xlsx' || fileExt === '.xls' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel') {
            return parseExcelFile(file.buffer, file.originalname);
        } else {
            // Try to detect by file signature (magic numbers)
            const fileSignature = file.buffer.slice(0, 4);
            const signature = Array.from(fileSignature).map(b => b.toString(16).padStart(2, '0')).join('');

            // Excel file signatures
            if (signature.startsWith('504b') || signature.startsWith('d0cf')) {
                console.log('Detected Excel file by signature');
                return parseExcelFile(file.buffer, file.originalname);
            }

            // Try CSV as last resort
            console.log('Attempting CSV parsing as fallback');
            return await parseCSVFile(file.buffer, file.originalname);
        }
    } catch (parseError) {
        console.error('File parsing failed:', parseError);
        throw new Error(`Unable to parse file "${file.originalname}": ${parseError.message}`);
    }
}

// Optimized record validation with early exits
function validateRecord(record, headerMapping) {
    const cleanedRecord = {};
    const errors = [];
    const providedFields = [];

    // Map headers to schema fields
    for (const [originalHeader, schemaField] of Object.entries(headerMapping)) {
        if (record[originalHeader] === undefined || record[originalHeader] === null) continue;

        const value = String(record[originalHeader]).trim();
        if (value === '' || value === 'undefined' || value === 'null') continue;

        cleanedRecord[schemaField] = value.replace(MULTISPACE_REGEX, ' ').trim();
        providedFields.push(schemaField);
    }

    // Required field validations with early exit
    if (!cleanedRecord.materialcode) {
        errors.push('Material Code is required');
    }
    if (!cleanedRecord.materialdescription) {
        errors.push('Material Description is required');
    }
    if (!cleanedRecord.quantity) {
        errors.push('Quantity is required');
    }
    if (!cleanedRecord.storagelocation) {
        errors.push('Storage Location is required');
    }

    // Early exit if required fields are missing
    if (errors.length > 0) {
        return { cleanedRecord, errors, providedFields };
    }

    // Length validation
    if (cleanedRecord.materialcode.length > 50) {
        errors.push('Material Code too long (max 50 characters)');
    }
    if (cleanedRecord.materialdescription.length > 500) {
        errors.push('Material Description too long (max 500 characters)');
    }
    if (cleanedRecord.storagelocation.length > 100) {
        errors.push('Storage Location too long (max 100 characters)');
    }

    // Quantity validation
    const quantity = parseFloat(cleanedRecord.quantity);
    if (isNaN(quantity)) {
        errors.push('Quantity must be a valid number');
    } else if (quantity < 0) {
        errors.push('Quantity cannot be negative');
    } else {
        cleanedRecord.quantity = quantity;
    }

    // Status validation - accept if provided, validate if present
    if (cleanedRecord.status) {
        // Validate status values if needed
        const validStatuses = ['Active', 'Inactive', 'Pending', 'Blocked', 'Suspended'];
        if (!validStatuses.includes(cleanedRecord.status)) {
            // If invalid status provided, you can either:
            // Option 1: Add error
            // errors.push(`Invalid status. Valid values: ${validStatuses.join(', ')}`);

            // Option 2: Set to default (uncomment below line)
            // cleanedRecord.status = 'Active';

            // Option 3: Keep as-is (current behavior - accepts any status value)
        }
    }
    // If status is not provided, it will remain undefined and won't be included in the record

    return { cleanedRecord, errors, providedFields };
}



// MAIN ROUTE - Complete implementation
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
            deletedExisting: 0,
            created: 0,
            failed: 0,
            duplicatesInFile: 0,
            skippedTotal: 0
        },
        headerMapping: {},
        errors: [],
        warnings: [],
        fileInfo: {}, // Add file info
        deletionPhase: {
            status: 'pending',
            totalExisting: 0,
            deleted: 0,
            progress: 0
        },
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

        // Add file information to response
        response.fileInfo = {
            originalName: req.file.originalname,
            size: req.file.size,
            mimeType: req.file.mimetype,
            extension: getFileExtension(req.file.originalname)
        };

        // Set headers for streaming response
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Parse file with enhanced method
        let jsonData;
        try {
            jsonData = await parseUploadedFile(req.file);
        } catch (parseError) {
            console.error('File parsing failed:', parseError);
            response.status = 'failed';
            response.errors.push(parseError.message);
            return res.status(400).json(response);
        }

        if (!jsonData || jsonData.length === 0) {
            response.status = 'failed';
            response.errors.push('No valid data found in file');
            return res.status(400).json(response);
        }

        console.log(`Successfully parsed file. Found ${jsonData.length} records`);
        response.totalRecords = jsonData.length;
        response.batchProgress.totalBatches = Math.ceil(jsonData.length / BATCH_SIZE);

        // Map headers with optimized method
        const headers = Object.keys(jsonData[0] || {});
        const headerMapping = mapHeaders(headers);
        response.headerMapping = headerMapping;

        // Check for required fields with optimized lookup
        const requiredFields = ['materialcode', 'materialdescription', 'quantity', 'storagelocation'];
        const missingFields = requiredFields.filter(field => !Object.values(headerMapping).includes(field));

        if (missingFields.length > 0) {
            const fieldDisplayNames = {
                'materialcode': 'Material Code',
                'materialdescription': 'Material Description',
                'quantity': 'Quantity',
                'storagelocation': 'Storage Location'
            };
            response.status = 'failed';
            response.errors.push(
                `Required headers not found: ${missingFields.map(f => fieldDisplayNames[f]).join(', ')}. ` +
                `Available headers: ${headers.join(', ')}`
            );
            return res.status(400).json(response);
        }

        // Send initial response
        res.write(JSON.stringify(response) + '\n');

        // Phase 1: Delete existing records (optimized)
        response.deletionPhase.status = 'processing';
        const totalExisting = await HubStock.estimatedDocumentCount(); // Faster than countDocuments
        response.deletionPhase.totalExisting = totalExisting;

        if (totalExisting > 0) {
            res.write(JSON.stringify({
                ...response,
                deletionPhase: { ...response.deletionPhase, status: 'deleting' }
            }) + '\n');

            // Use collection.drop() for faster deletion when we're replacing all data
            await HubStock.collection.drop();
            await HubStock.createCollection(); // Recreate collection immediately

            response.deletionPhase.deleted = totalExisting;
            response.summary.deletedExisting = totalExisting;
        }

        response.deletionPhase.status = 'completed';
        response.deletionPhase.progress = 100;

        res.write(JSON.stringify({
            ...response,
            deletionPhase: response.deletionPhase
        }) + '\n');

        // Phase 2: Process records in parallel batches
        const processBatch = async (batch, batchIndex) => {
            const batchResults = [];
            const validRecords = [];
            const processedKeys = new Set();
            let batchCreated = 0;
            let batchFailed = 0;
            let batchSkipped = 0;

            // Process each record in the batch
            for (const [index, record] of batch.entries()) {
                const rowNumber = (batchIndex * BATCH_SIZE) + index + 1;
                const recordResult = {
                    row: rowNumber,
                    materialcode: '',
                    materialdescription: '',
                    quantity: '',
                    storagelocation: '',
                    status: 'Processing',
                    action: '',
                    error: null,
                    warnings: []
                };

                try {
                    const { cleanedRecord, errors } = validateRecord(record, headerMapping);
                    recordResult.materialcode = cleanedRecord.materialcode || 'Unknown';
                    recordResult.materialdescription = cleanedRecord.materialdescription || 'N/A';
                    recordResult.quantity = cleanedRecord.quantity || 0;
                    recordResult.storagelocation = cleanedRecord.storagelocation || 'N/A';

                    // Show the actual status from file or 'Not Provided' if empty
                    recordResult.fileStatus = cleanedRecord.status || 'Not Provided';

                    if (errors.length > 0) {
                        recordResult.status = 'Failed';
                        recordResult.error = errors.join(', ');
                        recordResult.action = 'Validation failed';
                        batchResults.push(recordResult);
                        batchFailed++;
                        continue;
                    }

                    const uniqueKey = `${cleanedRecord.materialcode}_${cleanedRecord.storagelocation}`;

                    if (processedKeys.has(uniqueKey)) {
                        recordResult.status = 'Skipped';
                        recordResult.error = 'Duplicate combination in file';
                        recordResult.action = 'Skipped due to file duplicate';
                        recordResult.warnings.push('Duplicate combination already processed');
                        batchResults.push(recordResult);
                        batchSkipped++;
                        continue;
                    }

                    processedKeys.add(uniqueKey);
                    validRecords.push(cleanedRecord);

                    recordResult.status = 'Created';
                    recordResult.action = 'Created new record';
                    batchResults.push(recordResult);
                    batchCreated++;

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
                try {
                    // Use insertMany with ordered: false for better performance
                    const insertResult = await HubStock.insertMany(validRecords, {
                        ordered: false,
                        lean: true
                    });

                    batchCreated = insertResult.length;

                } catch (insertError) {
                    // Handle MongoDB BulkWriteError properly
                    if (insertError.name === 'BulkWriteError' || insertError.name === 'MongoBulkWriteError') {
                        const insertedCount = insertError.result?.insertedCount || 0;
                        const failedCount = validRecords.length - insertedCount;

                        batchCreated = insertedCount;
                        batchFailed += failedCount;

                        // Update record statuses based on actual results
                        if (insertError.writeErrors && insertError.writeErrors.length > 0) {
                            insertError.writeErrors.forEach((writeError) => {
                                const failedIndex = writeError.index;
                                if (batchResults[failedIndex] && batchResults[failedIndex].status === 'Created') {
                                    batchResults[failedIndex].status = 'Failed';
                                    batchResults[failedIndex].action = 'Database insert failed';
                                    batchResults[failedIndex].error = writeError.errmsg || 'Insert operation failed';
                                }
                            });
                        }
                    } else {
                        // Handle other types of errors
                        batchResults.forEach(result => {
                            if (result.status === 'Created') {
                                result.status = 'Failed';
                                result.action = 'Database connection error';
                                result.error = insertError.message;
                            }
                        });

                        batchFailed += validRecords.length;
                        batchCreated = 0;
                    }
                }
            }

            return {
                batchResults,
                batchCreated,
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
                    r => r.status === 'Skipped' && r.error === 'Duplicate combination in file'
                ).length;
                response.results.push(...completedBatch.batchResults);

                res.write(JSON.stringify({
                    ...response,
                    batchCompleted: true,
                    batchSummary: {
                        created: completedBatch.batchCreated,
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
                r => r.status === 'Skipped' && r.error === 'Duplicate combination in file'
            ).length;
            response.results.push(...completedBatch.batchResults);

            res.write(JSON.stringify({
                ...response,
                batchCompleted: true,
                batchSummary: {
                    created: completedBatch.batchCreated,
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
            `Deleted existing: ${response.summary.deletedExisting}, ` +
            `Created: ${response.summary.created}, ` +
            `Failed: ${response.summary.failed}, ` +
            `File Duplicates: ${response.summary.duplicatesInFile}, ` +
            `Total Skipped: ${response.summary.skippedTotal}`;

        res.write(JSON.stringify(response) + '\n');
        res.end();

    } catch (error) {
        console.error('HubStock bulk upload error:', error);
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
