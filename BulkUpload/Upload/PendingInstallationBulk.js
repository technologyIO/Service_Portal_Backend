const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { parse, isValid } = require('date-fns');

// Import Mongoose model
const PendingInstallation = require('../../Model/UploadSchema/PendingInstallationSchema');

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

function normalizeFieldName(fieldName) {
  if (!fieldName) return '';

  return fieldName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}


function mapHeaders(headers) {
  const fieldMapping = {
    'invoiceno': [
      'invoiceno',
      'invoice_no',
      'invoicenumber',
      'invoice_number',
      'billno',
      'bill_no'
    ],
    'invoicedate': [
      'invoicedate',
      'invoice_date',
      'billdate',
      'bill_date',
      'date'
    ],
    'distchnl': [
      'distchnl',
      'dist_chnl',
      'distributionchannel',
      'distribution_channel',
      'channel'
    ],
    'customerid': [
      'customerid',
      'customer_id',
      'custid',
      'cust_id',
      'customercode',
      'customer_code'
    ],
    'customername1': [
      'customername1',
      'customer_name1',
      'customername',
      'customer_name',
      'name1'
    ],
    'customername2': [
      'customername2',
      'customer_name2',
      'name2',
      'hospitalname',
      'hospital_name'
    ],
    'customercity': [
      'customercity',
      'customer_city',
      'city'
    ],
    'customerpostalcode': [
      'customerpostalcode',
      'customer_postal_code',
      'postalcode',
      'postal_code',
      'pincode',
      'zip'
    ],
    'material': [
      'material',
      'materialcode',
      'material_code',
      'productcode',
      'product_code',
      'partno',
      'part_no'
    ],
    'description': [
      'description',
      'materialdescription',
      'material_description',
      'productdescription',
      'product_description',
      'desc'
    ],
    'serialnumber': [
      'serialnumber',
      'serial_number',
      'serialno',
      'serial_no',
      'sno'
    ],
    'salesdist': [
      'salesdist',
      'sales_dist',
      'salesdistrict',
      'sales_district'
    ],
    'salesoff': [
      'salesoff',
      'sales_off',
      'salesoffice',
      'sales_office'
    ],
    'customercountry': [
      'customercountry',
      'customer_country',
      'country'
    ],
    'customerregion': [
      'customerregion',
      'customer_region',
      'region'
    ],
    'currentcustomerid': [
      'currentcustomerid',
      'current_customer_id',
      'currentcustid',
      'current_cust_id'
    ],
    'currentcustomername1': [
      'currentcustomername1',
      'current_customer_name1',
      'currentcustomername',
      'current_customer_name'
    ],
    'currentcustomername2': [
      'currentcustomername2',
      'current_customer_name2',
      'currenthospitalname',
      'current_hospital_name'
    ],
    'currentcustomercity': [
      'currentcustomercity',
      'current_customer_city',
      'currentcity',
      'current_city'
    ],
    'currentcustomerregion': [
      'currentcustomerregion',
      'current_customer_region',
      'currentregion',
      'current_region'
    ],
    'currentcustomerpostalcode': [
      'currentcustomerpostalcode',
      'current_customer_postal_code',
      'currentpostalcode',
      'current_postal_code'
    ],
    'currentcustomercountry': [
      'currentcustomercountry',
      'current_customer_country',
      'currentcountry',
      'current_country'
    ],
    'mtlgrp4': [
      'mtlgrp4',
      'mtl_grp4',
      'materialgroup4',
      'material_group4',
      'mtlgroup4',
      'mtl_group4'
    ],
    'key': [
      'key',
      'keyfield',
      'key_field',
      'id'
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
 * Universal date parser supporting multiple formats and Excel serials
 */
function parseUniversalDate(dateInput) {
  if (!dateInput) return null;

  if (dateInput instanceof Date && !isNaN(dateInput)) {
    return dateInput;
  }

  if (typeof dateInput === 'number') {
    try {
      const excelDate = XLSX.SSF.parse_date_code(dateInput);
      return new Date(excelDate.y, excelDate.m - 1, excelDate.d);
    } catch (e) {
      return null;
    }
  }

  const formats = [
    'dd/MM/yyyy', 'dd-MM-yyyy', 'dd.MM.yyyy',
    'MM/dd/yyyy', 'MM-dd-yyyy', 'MM.dd.yyyy',
    'yyyy/MM/dd', 'yyyy-MM-dd', 'yyyy.MM.dd',
    'd/M/yyyy', 'd-M-yyyy', 'd.M.yyyy',
    'M/d/yyyy', 'M-d-yyyy', 'M.d.yyyy',
    'dd/MM/yy', 'dd-MM-yy', 'dd.MM.yy'
  ];

  for (const format of formats) {
    try {
      const parsedDate = parse(dateInput.toString(), format, new Date());
      if (isValid(parsedDate)) {
        return parsedDate;
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

/**
 * Parse Excel file to JSON
 */
function parseExcelFile(buffer) {
  try {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      dateNF: 'dd"/"mm"/"yyyy;@'
    });
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
      let value = String(record[originalHeader]).trim();

      // Special handling for dates
      if (schemaField === 'invoicedate') {
        const parsedDate = parseUniversalDate(record[originalHeader]);
        if (parsedDate) {
          cleanedRecord[schemaField] = parsedDate;
        }
      } else if (value !== '') {
        cleanedRecord[schemaField] = value;
      }
    }
  }

  // Validation
  const errors = [];

  // Required fields validation
  if (!cleanedRecord.invoiceno || cleanedRecord.invoiceno === '') {
    errors.push('Invoice No is required');
  }

  if (!cleanedRecord.serialnumber || cleanedRecord.serialnumber === '') {
    errors.push('Serial Number is required');
  }

  // Additional validation
  if (cleanedRecord.invoiceno && cleanedRecord.invoiceno.length > 50) {
    errors.push('Invoice No too long (max 50 characters)');
  }

  if (cleanedRecord.serialnumber && cleanedRecord.serialnumber.length > 50) {
    errors.push('Serial Number too long (max 50 characters)');
  }

  // Clean up text fields
  const textFields = [
    'invoiceno', 'distchnl', 'customerid', 'customername1', 'customername2',
    'customercity', 'customerpostalcode', 'material', 'description',
    'serialnumber', 'salesdist', 'salesoff', 'customercountry',
    'customerregion', 'currentcustomerid', 'currentcustomername1',
    'currentcustomername2', 'currentcustomercity', 'currentcustomerregion',
    'currentcustomerpostalcode', 'currentcustomercountry', 'mtlgrp4', 'key'
  ];

  textFields.forEach(field => {
    if (cleanedRecord[field]) {
      cleanedRecord[field] = cleanedRecord[field].replace(/\s+/g, ' ').trim();
    }
  });

  return { cleanedRecord, errors };
}

// Bulk upload route for Pending Installation
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
    const hasInvoiceField = Object.values(headerMapping).includes('invoiceno');
    const hasSerialField = Object.values(headerMapping).includes('serialnumber');

    if (!hasInvoiceField || !hasSerialField) {
      response.status = 'failed';
      const missingFields = [];
      if (!hasInvoiceField) missingFields.push('Invoice No');
      if (!hasSerialField) missingFields.push('Serial Number');

      response.errors.push(
        `Required headers not found: ${missingFields.join(', ')}. ` +
        `Available headers: ${headers.join(', ')}. ` +
        `Please ensure your file contains "Invoice No" and "Serial Number" columns.`
      );
      return res.status(400).json(response);
    }

    // Send initial response
    res.write(JSON.stringify(response) + '\n');

    // Process records in batches
    const BATCH_SIZE = 50;
    const processedSerialNumbers = new Set();

    for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
      const batch = jsonData.slice(i, i + BATCH_SIZE);

      // Process each record in the batch
      for (const [index, record] of batch.entries()) {
        const recordResult = {
          row: i + index + 2, // +2 because Excel rows start from 1 and we skip header
          invoiceno: '',
          serialnumber: '',
          status: 'Processing',
          action: '',
          error: null,
          warnings: []
        };

        try {
          // Validate and clean record
          const { cleanedRecord, errors } = validateRecord(record, headerMapping);
          recordResult.invoiceno = cleanedRecord.invoiceno || 'Unknown';
          recordResult.serialnumber = cleanedRecord.serialnumber || 'Unknown';

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
          if (processedSerialNumbers.has(cleanedRecord.serialnumber)) {
            recordResult.status = 'Skipped';
            recordResult.error = 'Duplicate Serial Number in file';
            recordResult.action = 'Skipped due to file duplicate';
            recordResult.warnings.push('Serial Number already processed in this file');
            response.results.push(recordResult);
            response.summary.duplicatesInFile++;
            response.summary.skippedTotal++;
            response.processedRecords++;
            continue;
          }

          processedSerialNumbers.add(cleanedRecord.serialnumber);

          // Check if record exists in database
          const existingRecord = await PendingInstallation.findOne({
            serialnumber: cleanedRecord.serialnumber
          });

          if (existingRecord) {
            // Update existing record
            const updatedRecord = await PendingInstallation.findOneAndUpdate(
              { serialnumber: cleanedRecord.serialnumber },
              {
                ...cleanedRecord,
                modifiedAt: new Date()
              },
              { new: true, runValidators: true }
            );

            recordResult.status = 'Updated';
            recordResult.action = 'Updated existing record';
            response.summary.updated++;
            response.successfulRecords++;
          } else {
            // Create new record
            const newRecord = new PendingInstallation(cleanedRecord);
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
            recordResult.error = 'Duplicate Serial Number - already exists in database';
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
