const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const DealerStock = require('../../Model/UploadSchema/DealerStockSchema');

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
    'dealercodeid': new Set(['dealercodeid', 'dealer_code_id', 'dealercode', 'dealer_code', 'code', 'dealerid', 'dealer_id']),
    'dealername': new Set(['dealername', 'dealer_name', 'name', 'dealer', 'dealertitle', 'dealer_title']),
    'dealercity': new Set(['dealercity', 'dealer_city', 'city', 'location', 'dealerlocation', 'dealer_location']),
    'materialcode': new Set(['materialcode', 'material_code', 'partno', 'part_no', 'productcode', 'product_code', 'itemcode', 'item_code']),
    'materialdescription': new Set(['materialdescription', 'material_description', 'description', 'desc', 'product_description', 'item_description', 'material_desc']),
    'plant': new Set(['plant', 'factory', 'location', 'facility', 'warehouse', 'depot']),
    'unrestrictedquantity': new Set(['unrestrictedquantity', 'unrestricted_quantity', 'quantity', 'qty', 'stock', 'available_quantity', 'available_qty', 'free_stock', 'freestock'])
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
    if (!cleanedRecord.dealercodeid) {
        errors.push('Dealer Code is required');
    }
    if (!cleanedRecord.dealername) {
        errors.push('Dealer Name is required');
    }
    if (!cleanedRecord.dealercity) {
        errors.push('Dealer City is required');
    }
    if (!cleanedRecord.materialcode) {
        errors.push('Material Code is required');
    }
    if (!cleanedRecord.materialdescription) {
        errors.push('Material Description is required');
    }
    if (!cleanedRecord.plant) {
        errors.push('Plant is required');
    }
    if (!cleanedRecord.unrestrictedquantity) {
        errors.push('Unrestricted Quantity is required');
    }

    // Early exit if required fields are missing
    if (errors.length > 0) {
        return { cleanedRecord, errors, providedFields };
    }

    // Length validation
    if (cleanedRecord.dealercodeid.length > 50) {
        errors.push('Dealer Code too long (max 50 characters)');
    }
    if (cleanedRecord.dealername.length > 200) {
        errors.push('Dealer Name too long (max 200 characters)');
    }
    if (cleanedRecord.dealercity.length > 100) {
        errors.push('Dealer City too long (max 100 characters)');
    }
    if (cleanedRecord.materialcode.length > 50) {
        errors.push('Material Code too long (max 50 characters)');
    }
    if (cleanedRecord.materialdescription.length > 500) {
        errors.push('Material Description too long (max 500 characters)');
    }
    if (cleanedRecord.plant.length > 50) {
        errors.push('Plant too long (max 50 characters)');
    }

    // Quantity validation
    const quantity = parseFloat(cleanedRecord.unrestrictedquantity);
    if (isNaN(quantity)) {
        errors.push('Unrestricted Quantity must be a valid number');
    } else if (quantity < 0) {
        errors.push('Unrestricted Quantity cannot be negative');
    } else {
        cleanedRecord.unrestrictedquantity = quantity;
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
            deletedExisting: 0,
            created: 0,
            failed: 0,
            duplicatesInFile: 0,
            skippedTotal: 0
        },
        headerMapping: {},
        errors: [],
        warnings: [],
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
        const requiredFields = ['dealercodeid', 'dealername', 'dealercity', 'materialcode', 'materialdescription', 'plant', 'unrestrictedquantity'];
        const missingFields = requiredFields.filter(field => !Object.values(headerMapping).includes(field));
        
        if (missingFields.length > 0) {
            const fieldDisplayNames = {
                'dealercodeid': 'Dealer Code',
                'dealername': 'Dealer Name',
                'dealercity': 'Dealer City',
                'materialcode': 'Material Code',
                'materialdescription': 'Material Description',
                'plant': 'Plant',
                'unrestrictedquantity': 'Unrestricted Quantity'
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
        const totalExisting = await DealerStock.estimatedDocumentCount(); // Faster than countDocuments
        response.deletionPhase.totalExisting = totalExisting;
        
        if (totalExisting > 0) {
            res.write(JSON.stringify({
                ...response,
                deletionPhase: { ...response.deletionPhase, status: 'deleting' }
            }) + '\n');
            
            // Use collection.drop() for faster deletion when we're replacing all data
            await DealerStock.collection.drop();
            await DealerStock.createCollection(); // Recreate collection immediately
            
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
                    dealercodeid: '',
                    dealername: '',
                    materialcode: '',
                    status: 'Processing',
                    action: '',
                    error: null,
                    warnings: []
                };

                try {
                    const { cleanedRecord, errors } = validateRecord(record, headerMapping);
                    recordResult.dealercodeid = cleanedRecord.dealercodeid || 'Unknown';
                    recordResult.dealername = cleanedRecord.dealername || 'N/A';
                    recordResult.materialcode = cleanedRecord.materialcode || 'N/A';

                    if (errors.length > 0) {
                        recordResult.status = 'Failed';
                        recordResult.error = errors.join(', ');
                        recordResult.action = 'Validation failed';
                        batchResults.push(recordResult);
                        batchFailed++;
                        continue;
                    }

                    const uniqueKey = `${cleanedRecord.dealercodeid}_${cleanedRecord.materialcode}_${cleanedRecord.plant}`;
                    
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
                    const insertResult = await DealerStock.insertMany(validRecords, { 
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
        console.error('DealerStock bulk upload error:', error);
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