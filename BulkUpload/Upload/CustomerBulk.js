const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Import Mongoose model
const Customer = require('../../Model/UploadSchema/CustomerSchema');

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
 */
function mapHeaders(headers) {
    const fieldMapping = {
        'customercodeid': [
            'customercodeid',
            'customercode',
            'customer_code',
            'customer_id',
            'custcode',
            'cust_code',
            'code'
        ],
        'customername': [
            'customername',
            'customer_name',
            'name1',
            'name',
            'customername1',
            'customer_name1'
        ],
        'hospitalname': [
            'hospitalname',
            'hospital_name',
            'name2',
            'customername2',
            'customer_name2',
            'hospital'
        ],
        'street': [
            'street',
            'streetaddress',
            'street_address',
            'address1',
            'address',
            'addr1'
        ],
        'city': [
            'city',
            'cityname',
            'city_name'
        ],
        'postalcode': [
            'postalcode',
            'postal_code',
            'pincode',
            'pin_code',
            'zipcode',
            'zip_code',
            'zip'
        ],
        'district': [
            'district',
            'dist',
            'districtname',
            'district_name'
        ],
        'region': [
            'region',
            'regionname',
            'region_name',
            'zone'
        ],
        'country': [
            'country',
            'countryname',
            'country_name',
            'nation'
        ],
        'telephone': [
            'telephone',
            'phone',
            'phonenumber',
            'phone_number',
            'mobile',
            'contact',
            'contactno',
            'contact_no'
        ],
        'taxnumber1': [
            'taxnumber1',
            'tax_number1',
            'taxno1',
            'tax_no1',
            'gst',
            'gstin',
            'tax1'
        ],
        'taxnumber2': [
            'taxnumber2',
            'tax_number2',
            'taxno2',
            'tax_no2',
            'pan',
            'tax2'
        ],
        'email': [
            'email',
            'emailaddress',
            'email_address',
            'emailid',
            'email_id'
        ]
    };
    
    const mappedHeaders = {};
    
    headers.forEach(header => {
        const originalHeader = header;
        const normalizedHeader = normalizeFieldName(header);
        
        // Check for exact matches
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
    
    // Required field validation - only Customer Code is required
    if (!cleanedRecord.customercodeid || cleanedRecord.customercodeid === '') {
        errors.push('Customer Code is required');
    }
    
    // Additional validation
    if (cleanedRecord.customercodeid) {
        if (cleanedRecord.customercodeid.length > 50) {
            errors.push('Customer Code too long (max 50 characters)');
        }
        // Clean up customer code
        cleanedRecord.customercodeid = cleanedRecord.customercodeid.replace(/\s+/g, ' ').trim();
    }
    
    // Email validation
    if (cleanedRecord.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanedRecord.email)) {
            errors.push('Invalid email format');
        }
    }
    
    // Phone validation
    if (cleanedRecord.telephone) {
        const phoneRegex = /^[\+]?[0-9\-\(\)\s]{10,}$/;
        if (!phoneRegex.test(cleanedRecord.telephone)) {
            errors.push('Invalid telephone format');
        }
    }
    
    // Clean up text fields
    const textFields = [
        'customercodeid', 'customername', 'hospitalname', 'street', 'city',
        'postalcode', 'district', 'region', 'country', 'telephone',
        'taxnumber1', 'taxnumber2', 'email'
    ];
    
    textFields.forEach(field => {
        if (cleanedRecord[field]) {
            cleanedRecord[field] = cleanedRecord[field].replace(/\s+/g, ' ').trim();
        }
    });
    
    return { cleanedRecord, errors };
}

// Bulk upload route for Customer
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
            duplicatesInFile: 0,
            existingRecords: 0,
            skippedTotal: 0
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
        const hasCustomerCodeField = Object.values(headerMapping).includes('customercodeid');
        
        if (!hasCustomerCodeField) {
            response.status = 'failed';
            response.errors.push(
                `Required header not found: Customer Code. ` +
                `Available headers: ${headers.join(', ')}. ` +
                `Please ensure your file contains a "Customer Code" column.`
            );
            return res.status(400).json(response);
        }

        // Send initial response
        res.write(JSON.stringify(response) + '\n');

        // Process records in batches
        const BATCH_SIZE = 50;
        const processedCustomerCodes = new Set();

        for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
            const batch = jsonData.slice(i, i + BATCH_SIZE);

            // Process each record in the batch
            for (const [index, record] of batch.entries()) {
                const recordResult = {
                    row: i + index + 2, // +2 because Excel rows start from 1 and we skip header
                    customercodeid: '',
                    customername: '',
                    status: 'Processing',
                    action: '',
                    error: null,
                    warnings: []
                };

                try {
                    // Validate and clean record
                    const { cleanedRecord, errors } = validateRecord(record, headerMapping);
                    recordResult.customercodeid = cleanedRecord.customercodeid || 'Unknown';
                    recordResult.customername = cleanedRecord.customername || 'N/A';

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
                    if (processedCustomerCodes.has(cleanedRecord.customercodeid)) {
                        recordResult.status = 'Skipped';
                        recordResult.error = 'Duplicate Customer Code in file';
                        recordResult.action = 'Skipped due to file duplicate';
                        recordResult.warnings.push('Customer Code already processed in this file');
                        response.results.push(recordResult);
                        response.summary.duplicatesInFile++;
                        response.summary.skippedTotal++;
                        response.processedRecords++;
                        continue;
                    }

                    processedCustomerCodes.add(cleanedRecord.customercodeid);

                    // Check if record exists in database
                    const existingRecord = await Customer.findOne({ 
                        customercodeid: cleanedRecord.customercodeid 
                    });
                    
                    if (existingRecord) {
                        // Check if any field is different
                        let hasChanges = false;
                        const changes = {};
                        
                        for (const key in cleanedRecord) {
                            if (key === 'createdAt' || key === 'modifiedAt') continue;
                            
                            const existingValue = String(existingRecord[key] || '').trim();
                            const newValue = String(cleanedRecord[key] || '').trim();
                            
                            if (existingValue !== newValue) {
                                hasChanges = true;
                                changes[key] = { old: existingValue, new: newValue };
                            }
                        }
                        
                        if (hasChanges) {
                            // Update existing record
                            const updatedRecord = await Customer.findOneAndUpdate(
                                { customercodeid: cleanedRecord.customercodeid },
                                {
                                    ...cleanedRecord,
                                    modifiedAt: new Date()
                                },
                                { new: true, runValidators: true }
                            );

                            recordResult.status = 'Updated';
                            recordResult.action = 'Updated existing record with changes';
                            response.summary.updated++;
                            response.successfulRecords++;
                        } else {
                            recordResult.status = 'Skipped';
                            recordResult.action = 'No changes required';
                            recordResult.warnings.push('Customer Code already exists with same data');
                            response.summary.existingRecords++;
                            response.summary.skippedTotal++;
                        }
                    } else {
                        // Create new record with timestamps
                        const newRecord = new Customer({
                            ...cleanedRecord,
                            createdAt: new Date(),
                            modifiedAt: new Date()
                        });
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
                        recordResult.error = 'Duplicate Customer Code - already exists in database';
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
