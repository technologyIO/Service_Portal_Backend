const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Import Mongoose model
const Aerb = require('../../Model/MasterSchema/AerbSchema');

// Multer memory storage for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv', // .csv
            'application/csv'
        ];
        
        if (allowedTypes.includes(file.mimetype) || 
            file.originalname.toLowerCase().endsWith('.csv') ||
            file.originalname.toLowerCase().endsWith('.xlsx') ||
            file.originalname.toLowerCase().endsWith('.xls')) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'), false);
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

/**
 * Clean and normalize field names for comparison
 * Removes spaces, special characters, and converts to lowercase
 */
function normalizeFieldName(fieldName) {
    if (!fieldName) return '';
    
    return fieldName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters including spaces
        .trim();
}

/**
 * Map Excel/CSV headers to schema fields
 * Primary focus on "Material Code" and "Material Description" from frontend
 */
function mapHeaders(headers) {
    const fieldMapping = {
        'materialcode': [
            'materialcode',           // Direct match
            'material_code',          // With underscore
            'partno',                 // Alternative names
            'part_no',
            'code',
            'item_code',
            'product_code'
        ],
        'materialdescription': [
            'materialdescription',    // Direct match
            'material_description',   // With underscore
            'description',            // Common alternatives
            'desc',
            'product_description',
            'item_description',
            'material_desc'
        ]
    };
    
    const mappedHeaders = {};
    
    headers.forEach(header => {
        const originalHeader = header;
        const normalizedHeader = normalizeFieldName(header);
        
        // Check for exact matches first (for "Material Code" and "Material Description")
        for (const [schemaField, variations] of Object.entries(fieldMapping)) {
            const found = variations.some(variation => {
                const normalizedVariation = normalizeFieldName(variation);
                return normalizedHeader === normalizedVariation;
            });
            
            if (found) {
                mappedHeaders[originalHeader] = schemaField;
                break;
            }
        }
    });
    
    return mappedHeaders;
}

/**
 * Parse Excel file to JSON
 */
function parseExcelFile(buffer) {
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    } catch (error) {
        throw new Error(`Excel parsing error: ${error.message}`);
    }
}

/**
 * Parse CSV file to JSON
 */
function parseCSVFile(buffer) {
    return new Promise((resolve, reject) => {
        const results = [];
        const readable = new Readable();
        readable.push(buffer);
        readable.push(null);
        
        readable
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

/**
 * Validate and clean record data
 */
function validateRecord(record, headerMapping) {
    const cleanedRecord = {};
    
    // Map headers to schema fields
    for (const [originalHeader, schemaField] of Object.entries(headerMapping)) {
        if (record[originalHeader] !== undefined && record[originalHeader] !== null) {
            const value = String(record[originalHeader]).trim();
            if (value !== '') {
                cleanedRecord[schemaField] = value;
            }
        }
    }
    
    // Validation
    const errors = [];
    
    if (!cleanedRecord.materialcode || cleanedRecord.materialcode === '') {
        errors.push('Material Code is required');
    }
    
    if (!cleanedRecord.materialdescription || cleanedRecord.materialdescription === '') {
        errors.push('Material Description is required');
    }
    
    // Additional validation
    if (cleanedRecord.materialcode) {
        if (cleanedRecord.materialcode.length > 50) {
            errors.push('Material Code too long (max 50 characters)');
        }
        // Remove any extra spaces
        cleanedRecord.materialcode = cleanedRecord.materialcode.replace(/\s+/g, ' ').trim();
    }
    
    if (cleanedRecord.materialdescription) {
        if (cleanedRecord.materialdescription.length > 500) {
            errors.push('Material Description too long (max 500 characters)');
        }
        // Clean up description
        cleanedRecord.materialdescription = cleanedRecord.materialdescription.replace(/\s+/g, ' ').trim();
    }
    
    return { cleanedRecord, errors };
}

// Bulk upload route for Aerb
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
    // Initialize response object with detailed tracking
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
            duplicatesInFile: 0,          // Duplicates within the uploaded file
            existingRecords: 0,           // Records that already exist with same data
            skippedTotal: 0               // Total skipped (duplicatesInFile + existingRecords)
        },
        headerMapping: {},
        errors: [],
        warnings: []
    };

    try {
        // Validate file upload
        if (!req.file) {
            response.status = 'failed';
            response.errors.push('No file uploaded');
            return res.status(400).json(response);
        }

        // Set headers for streaming response (AWS-compatible)
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Parse file based on type
        let jsonData;
        const fileName = req.file.originalname.toLowerCase();
        
        try {
            if (fileName.endsWith('.csv')) {
                jsonData = await parseCSVFile(req.file.buffer);
            } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                jsonData = parseExcelFile(req.file.buffer);
            } else {
                throw new Error('Unsupported file format. Please upload Excel (.xlsx, .xls) or CSV files only.');
            }
        } catch (parseError) {
            response.status = 'failed';
            response.errors.push(`File parsing error: ${parseError.message}`);
            return res.status(400).json(response);
        }

        if (!jsonData || jsonData.length === 0) {
            response.status = 'failed';
            response.errors.push('No data found in file or file is empty');
            return res.status(400).json(response);
        }

        response.totalRecords = jsonData.length;

        // Map headers
        const headers = Object.keys(jsonData[0] || {});
        const headerMapping = mapHeaders(headers);
        response.headerMapping = headerMapping;
        
        // Validate that we found the required headers
        const hasCodeField = Object.values(headerMapping).includes('materialcode');
        const hasDescField = Object.values(headerMapping).includes('materialdescription');
        
        if (!hasCodeField || !hasDescField) {
            response.status = 'failed';
            const missingFields = [];
            if (!hasCodeField) missingFields.push('Material Code');
            if (!hasDescField) missingFields.push('Material Description');
            
            response.errors.push(
                `Required headers not found: ${missingFields.join(', ')}. ` +
                `Available headers: ${headers.join(', ')}. ` +
                `Please ensure your file contains "Material Code" and "Material Description" columns.`
            );
            return res.status(400).json(response);
        }

        // Send initial response
        res.write(JSON.stringify(response) + '\n');

        // Process records in batches
        const BATCH_SIZE = 50;
        const processedMaterialCodes = new Set();

        for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
            const batch = jsonData.slice(i, i + BATCH_SIZE);

            // Process each record in the batch
            for (const [index, record] of batch.entries()) {
                const recordResult = {
                    row: i + index + 2, // +2 because Excel rows start from 1 and we skip header
                    materialcode: '',
                    materialdescription: '',
                    status: 'Processing',
                    action: '',
                    error: null,
                    warnings: []
                };

                try {
                    // Validate and clean record
                    const { cleanedRecord, errors } = validateRecord(record, headerMapping);
                    recordResult.materialcode = cleanedRecord.materialcode || 'Unknown';
                    recordResult.materialdescription = cleanedRecord.materialdescription || 'N/A';

                    if (errors.length > 0) {
                        recordResult.status = 'Failed';
                        recordResult.error = errors.join(', ');
                        recordResult.action = 'Validation failed';
                        response.results.push(recordResult);
                        response.failedRecords++;
                        response.summary.failed++;
                        response.processedRecords++;
                        continue;
                    }

                    // Check for duplicates within the file
                    if (processedMaterialCodes.has(cleanedRecord.materialcode)) {
                        recordResult.status = 'Skipped';
                        recordResult.error = 'Duplicate Material Code in file';
                        recordResult.action = 'Skipped due to file duplicate';
                        recordResult.warnings.push('Material Code already processed in this file');
                        response.results.push(recordResult);
                        response.summary.duplicatesInFile++;
                        response.summary.skippedTotal++;
                        response.processedRecords++;
                        continue;
                    }

                    processedMaterialCodes.add(cleanedRecord.materialcode);

                    // Check if record exists in database
                    const existingRecord = await Aerb.findOne({ materialcode: cleanedRecord.materialcode });
                    
                    if (existingRecord) {
                        // Check if description is different
                        if (existingRecord.materialdescription.trim() !== cleanedRecord.materialdescription.trim()) {
                            // Update existing record
                            const updatedRecord = await Aerb.findOneAndUpdate(
                                { materialcode: cleanedRecord.materialcode },
                                {
                                    materialdescription: cleanedRecord.materialdescription,
                                    modifiedAt: new Date()
                                },
                                { new: true, runValidators: true }
                            );

                            recordResult.status = 'Updated';
                            recordResult.action = 'Updated existing record with new description';
                            response.summary.updated++;
                            response.successfulRecords++;
                        } else {
                            recordResult.status = 'Skipped';
                            recordResult.action = 'No changes required';
                            recordResult.warnings.push('Material Code already exists with same description');
                            response.summary.existingRecords++;
                            response.summary.skippedTotal++;
                        }
                    } else {
                        // Create new record
                        const newRecord = new Aerb(cleanedRecord);
                        await newRecord.save();

                        recordResult.status = 'Created';
                        recordResult.action = 'Created new record';
                        response.summary.created++;
                        response.successfulRecords++;
                    }

                    response.results.push(recordResult);

                } catch (err) {
                    console.error(`Error processing record ${recordResult.row}:`, err);
                    recordResult.status = 'Failed';
                    recordResult.action = 'Database operation failed';
                    recordResult.error = err.message;
                    if (err.code === 11000) {
                        recordResult.error = 'Duplicate Material Code - already exists in database';
                    }
                    response.results.push(recordResult);
                    response.failedRecords++;
                    response.summary.failed++;
                }

                // Update progress
                response.processedRecords++;
            }

            // Send progress update after each batch
            const progressUpdate = {
                ...response,
                progress: Math.round((response.processedRecords / response.totalRecords) * 100)
            };
            res.write(JSON.stringify(progressUpdate) + '\n');

            // Small delay to prevent overwhelming the client
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Finalize response
        response.status = 'completed';
        response.endTime = new Date();
        response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;
        response.progress = 100;

        // Add detailed summary message
        response.message = `Processing completed successfully. ` +
            `Created: ${response.summary.created}, ` +
            `Updated: ${response.summary.updated}, ` +
            `Failed: ${response.summary.failed}, ` +
            `File Duplicates: ${response.summary.duplicatesInFile}, ` +
            `Existing Records: ${response.summary.existingRecords}, ` +
            `Total Skipped: ${response.summary.skippedTotal}`;

        // Final response
        res.write(JSON.stringify(response) + '\n');
        res.end();

    } catch (error) {
        console.error('Aerb bulk upload error:', error);
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
