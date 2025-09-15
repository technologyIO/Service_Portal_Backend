const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const DealerStock = require('../../Model/UploadSchema/DealerStockSchema');
const iconv = require('iconv-lite'); // Add this dependency: npm install iconv-lite

// Optimized: Pre-compiled regex patterns
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]/g;
const MULTISPACE_REGEX = /\s+/g;
const SPECIAL_CHARS_REGEX = /[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/g;
const INVALID_CHARS_REGEX = /[\uFFFD\u0000-\u001F\u007F-\u009F]/g;

// FIXED: More liberal file acceptance
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        try {
            const fileName = file.originalname.toLowerCase();
            console.log('File details:', {
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size
            });
            
            // Get file extension properly
            const fileExt = fileName.substring(fileName.lastIndexOf('.'));
            
            // Comprehensive MIME type checking
            const validMimeTypes = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
                'application/vnd.ms-excel', // .xls
                'application/excel',
                'application/x-excel',
                'application/x-msexcel',
                'text/csv',
                'application/csv',
                'text/comma-separated-values',
                'text/plain',
                'application/octet-stream' // Many Excel files come as this
            ];
            
            const validExtensions = ['.csv', '.xlsx', '.xls'];
            
            // Check both MIME type and extension
            const mimeTypeValid = validMimeTypes.includes(file.mimetype);
            const extensionValid = validExtensions.includes(fileExt);
            
            console.log('Validation:', {
                mimeTypeValid,
                extensionValid,
                fileExt,
                mimetype: file.mimetype
            });
            
            if (mimeTypeValid || extensionValid) {
                cb(null, true);
            } else {
                const error = new Error(`Unsupported file format. File: ${file.originalname}, MIME: ${file.mimetype}, Extension: ${fileExt}`);
                console.error('File filter error:', error.message);
                cb(error, false);
            }
        } catch (error) {
            console.error('File filter exception:', error);
            cb(error, false);
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Field mappings remain the same
const FIELD_MAPPINGS = {
    'dealercodeid': new Set(['dealercodeid', 'dealer_code_id', 'dealercode', 'dealer_code', 'code', 'dealerid', 'dealer_id']),
    'dealername': new Set(['dealername', 'dealer_name', 'name', 'dealer', 'dealertitle', 'dealer_title']),
    'dealercity': new Set(['dealercity', 'dealer_city', 'city', 'location', 'dealerlocation', 'dealer_location']),
    'materialcode': new Set(['materialcode', 'material_code', 'partno', 'part_no', 'productcode', 'product_code', 'itemcode', 'item_code']),
    'materialdescription': new Set(['materialdescription', 'material_description', 'description', 'desc', 'product_description', 'item_description', 'material_desc']),
    'plant': new Set(['plant', 'factory', 'location', 'facility', 'warehouse', 'depot']),
    'unrestrictedquantity': new Set(['unrestrictedquantity', 'unrestricted_quantity', 'quantity', 'qty', 'stock', 'available_quantity', 'available_qty', 'free_stock', 'freestock'])
};

// Enhanced function to clean and normalize text
function cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
        .replace(INVALID_CHARS_REGEX, '')
        .replace(SPECIAL_CHARS_REGEX, ' ')
        .replace(MULTISPACE_REGEX, ' ')
        .trim();
}

// FIXED: Enhanced Excel parsing with better error handling
function parseExcelFile(buffer) {
    try {
        console.log('Parsing Excel file, buffer size:', buffer.length);
        
        // Try multiple parsing approaches
        let workbook;
        try {
            // First attempt with standard options
            workbook = XLSX.read(buffer, { 
                type: 'buffer', 
                cellDates: true,
                codepage: 65001,
                raw: false,
                dense: false
            });
        } catch (firstError) {
            console.log('First parse attempt failed, trying alternative options:', firstError.message);
            // Second attempt with more permissive options
            try {
                workbook = XLSX.read(buffer, { 
                    type: 'buffer',
                    raw: true // Try with raw data
                });
            } catch (secondError) {
                console.log('Second parse attempt failed, trying buffer as array:', secondError.message);
                // Third attempt treating as array buffer
                workbook = XLSX.read(new Uint8Array(buffer), { 
                    type: 'array'
                });
            }
        }
        
        if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('No sheets found in Excel file');
        }
        
        const sheetName = workbook.SheetNames[0];
        console.log('Using sheet:', sheetName);
        
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            throw new Error(`Sheet "${sheetName}" not found`);
        }
        
        // Convert to JSON with proper options
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            defval: '', 
            raw: false,
            blankrows: false,
            header: 1 // Get array format first to handle headers properly
        });
        
        if (!jsonData || jsonData.length === 0) {
            throw new Error('No data found in Excel sheet');
        }
        
        // Convert array format to object format
        const headers = jsonData[0];
        const dataRows = jsonData.slice(1);
        
        const result = dataRows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                if (header && header.toString().trim()) {
                    const value = row[index];
                    obj[header.toString().trim()] = value !== undefined && value !== null ? 
                        (typeof value === 'string' ? cleanText(value) : value.toString()) : '';
                }
            });
            return obj;
        }).filter(row => Object.keys(row).length > 0); // Remove empty rows
        
        console.log('Excel parsing successful, rows found:', result.length);
        return result;
        
    } catch (error) {
        console.error('Excel parsing error details:', error);
        throw new Error(`Excel parsing failed: ${error.message}`);
    }
}

// FIXED: Enhanced CSV parsing with better encoding handling
function parseCSVFile(buffer) {
    return new Promise((resolve, reject) => {
        try {
            console.log('Parsing CSV file, buffer size:', buffer.length);
            
            const results = [];
            
            // Enhanced encoding detection
            let csvContent;
            try {
                // Try UTF-8 first
                csvContent = buffer.toString('utf8');
                
                // Check for encoding issues
                if (csvContent.includes('\uFFFD') || csvContent.includes('�')) {
                    console.log('UTF-8 encoding issues detected, trying alternative encodings');
                    
                    // Try Windows-1252
                    if (iconv.encodingExists('win1252')) {
                        csvContent = iconv.decode(buffer, 'win1252');
                        console.log('Using Windows-1252 encoding');
                    } else if (iconv.encodingExists('iso-8859-1')) {
                        csvContent = iconv.decode(buffer, 'iso-8859-1');
                        console.log('Using ISO-8859-1 encoding');
                    } else {
                        csvContent = cleanText(csvContent);
                        console.log('Using cleaned UTF-8');
                    }
                }
            } catch (encodingError) {
                console.warn('Encoding detection failed, using UTF-8:', encodingError.message);
                csvContent = buffer.toString('utf8');
            }
            
            // Create readable stream
            const stream = Readable.from(csvContent)
                .pipe(csv({
                    mapValues: ({ value }) => cleanText(value.toString()),
                    strict: false,
                    skipLines: 0,
                    skipEmptyLines: true,
                    separator: ',',
                    quote: '"',
                    escape: '"'
                }))
                .on('data', (data) => {
                    const cleanedData = {};
                    for (const [key, value] of Object.entries(data)) {
                        const cleanKey = cleanText(key);
                        const cleanValue = cleanText(value.toString());
                        if (cleanKey) {
                            cleanedData[cleanKey] = cleanValue;
                        }
                    }
                    if (Object.keys(cleanedData).length > 0) {
                        results.push(cleanedData);
                    }
                })
                .on('end', () => {
                    console.log('CSV parsing successful, rows found:', results.length);
                    resolve(results);
                })
                .on('error', (error) => {
                    console.error('CSV parsing error:', error);
                    reject(new Error(`CSV parsing failed: ${error.message}`));
                });

            // Set timeout for CSV parsing
            setTimeout(() => {
                if (!stream.destroyed) {
                    stream.destroy();
                    reject(new Error('CSV parsing timeout'));
                }
            }, 30000); // 30 second timeout
            
        } catch (error) {
            console.error('CSV parsing setup error:', error);
            reject(new Error(`CSV setup failed: ${error.message}`));
        }
    });
}

// Optimized normalizeFieldName with memoization
const normalizedFieldCache = new Map();
function normalizeFieldName(fieldName) {
    if (!fieldName) return '';
    if (normalizedFieldCache.has(fieldName)) {
        return normalizedFieldCache.get(fieldName);
    }
    const normalized = cleanText(fieldName.toString())
        .toLowerCase()
        .replace(NON_ALPHANUMERIC_REGEX, '')
        .trim();
    normalizedFieldCache.set(fieldName, normalized);
    return normalized;
}

// mapHeaders function remains the same
function mapHeaders(headers) {
    const mappedHeaders = {};
    const seenFields = new Set();

    for (const header of headers) {
        const normalizedHeader = normalizeFieldName(header);

        if (seenFields.has(normalizedHeader)) continue;
        seenFields.add(normalizedHeader);

        for (const [schemaField, variations] of Object.entries(FIELD_MAPPINGS)) {
            if (variations.has(normalizedHeader)) {
                mappedHeaders[header] = schemaField;
                break;
            }
        }
    }

    return mappedHeaders;
}

// Enhanced record validation with better text cleaning
function validateRecord(record, headerMapping) {
    const cleanedRecord = {};
    const errors = [];
    const providedFields = [];

    for (const [originalHeader, schemaField] of Object.entries(headerMapping)) {
        if (record[originalHeader] === undefined || record[originalHeader] === null) continue;

        let value = String(record[originalHeader]).trim();
        if (value === '' || value === 'undefined' || value === 'null') continue;

        if (schemaField === 'materialdescription' || schemaField === 'dealername') {
            value = cleanText(value);
        } else {
            value = cleanText(value);
        }

        value = value.replace(MULTISPACE_REGEX, ' ').trim();

        if (value) {
            cleanedRecord[schemaField] = value;
            providedFields.push(schemaField);
        }
    }

    // Required field validations
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

    if (!cleanedRecord.status) {
        cleanedRecord.status = 'Active';
    }

    return { cleanedRecord, errors, providedFields };
}

// MAIN ROUTE - Enhanced with better file detection
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
    const BATCH_SIZE = 2000;
    const PARALLEL_BATCHES = 3;

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
        console.log('=== BULK UPLOAD START ===');
        
        if (!req.file) {
            console.error('No file uploaded');
            response.status = 'failed';
            response.errors.push('No file uploaded');
            return res.status(400).json(response);
        }

        console.log('File received:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            bufferLength: req.file.buffer.length
        });

        // Set headers for streaming response
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // FIXED: Enhanced file parsing with better detection
        let jsonData;
        const fileName = req.file.originalname.toLowerCase();
        const fileExt = fileName.substring(fileName.lastIndexOf('.'));

        console.log('File parsing details:', {
            fileName,
            fileExt,
            mimetype: req.file.mimetype
        });

        try {
            // Determine file type by extension first, then by MIME type
            if (fileExt === '.csv' || req.file.mimetype.includes('csv') || req.file.mimetype === 'text/plain') {
                console.log('Parsing as CSV file');
                jsonData = await parseCSVFile(req.file.buffer);
            } else if (fileExt === '.xlsx' || fileExt === '.xls' || 
                       req.file.mimetype.includes('excel') || 
                       req.file.mimetype.includes('spreadsheet') ||
                       req.file.mimetype === 'application/octet-stream') {
                console.log('Parsing as Excel file');
                jsonData = parseExcelFile(req.file.buffer);
            } else {
                // Try to detect by content if extension/MIME type are unclear
                console.log('File type unclear, attempting auto-detection');
                try {
                    // Try Excel first (more reliable detection)
                    jsonData = parseExcelFile(req.file.buffer);
                    console.log('Auto-detected as Excel file');
                } catch (excelError) {
                    console.log('Excel parsing failed, trying CSV:', excelError.message);
                    try {
                        jsonData = await parseCSVFile(req.file.buffer);
                        console.log('Auto-detected as CSV file');
                    } catch (csvError) {
                        console.error('Both Excel and CSV parsing failed');
                        throw new Error(`Unable to parse file. Excel error: ${excelError.message}, CSV error: ${csvError.message}`);
                    }
                }
            }
        } catch (parseError) {
            console.error('File parsing failed:', parseError);
            response.status = 'failed';
            response.errors.push(`File parsing error: ${parseError.message}`);
            return res.status(400).json(response);
        }

        if (!jsonData || jsonData.length === 0) {
            console.error('No data found in file');
            response.status = 'failed';
            response.errors.push('No data found in file or file is empty');
            return res.status(400).json(response);
        }

        console.log('File parsed successfully, records found:', jsonData.length);

        response.totalRecords = jsonData.length;
        response.batchProgress.totalBatches = Math.ceil(jsonData.length / BATCH_SIZE);

        // Map headers with optimized method
        const headers = Object.keys(jsonData[0] || {});
        console.log('Headers found:', headers);
        
        const headerMapping = mapHeaders(headers);
        response.headerMapping = headerMapping;
        console.log('Header mapping:', headerMapping);

        // Check for required fields
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
            console.error('Missing required fields:', missingFields);
            response.status = 'failed';
            response.errors.push(
                `Required headers not found: ${missingFields.map(f => fieldDisplayNames[f]).join(', ')}. ` +
                `Available headers: ${headers.join(', ')}`
            );
            return res.status(400).json(response);
        }

        // Send initial response
        res.write(JSON.stringify(response) + '\n');

        // Phase 1: Delete existing records
        response.deletionPhase.status = 'processing';
        const totalExisting = await DealerStock.estimatedDocumentCount();
        response.deletionPhase.totalExisting = totalExisting;
        
        if (totalExisting > 0) {
            res.write(JSON.stringify({
                ...response,
                deletionPhase: { ...response.deletionPhase, status: 'deleting' }
            }) + '\n');
            
            await DealerStock.collection.drop();
            await DealerStock.createCollection();
            
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
                    const insertResult = await DealerStock.insertMany(validRecords, { 
                        ordered: false,
                        lean: true
                    });
                    
                    batchCreated = insertResult.length;
                    
                } catch (insertError) {
                    if (insertError.name === 'BulkWriteError' || insertError.name === 'MongoBulkWriteError') {
                        const insertedCount = insertError.result?.insertedCount || 0;
                        const failedCount = validRecords.length - insertedCount;
                        
                        batchCreated = insertedCount;
                        batchFailed += failedCount;
                        
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

            res.write(JSON.stringify({
                ...response,
                batchProgress: response.batchProgress
            }) + '\n');

            if (batchPromises.length >= PARALLEL_BATCHES) {
                const completedBatch = await Promise.race(batchPromises);
                batchPromises.splice(batchPromises.indexOf(completedBatch), 1);

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

        console.log('=== BULK UPLOAD COMPLETED ===');
        console.log('Final summary:', response.summary);

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
