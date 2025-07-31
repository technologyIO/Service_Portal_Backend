const { parse, isValid, format, addMonths, differenceInMonths, startOfMonth } = require('date-fns');
const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Import Mongoose models
const Equipment = require('../../Model/MasterSchema/EquipmentSchema');
const PM = require('../../Model/UploadSchema/PMSchema');
const Product = require('../../Model/MasterSchema/ProductSchema');
const AMCContract = require('../../Model/UploadSchema/AMCContractSchema');
const Customer = require('../../Model/UploadSchema/CustomerSchema');

// Multer configuration with file type validation
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv'
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});
function buildNormalizedCustomerMap(customers) {
  const map = new Map();
  customers.forEach(c => {
    if (c.customercodeid) map.set(String(c.customercodeid).trim().toLowerCase(), c);
  });
  return map;
}
// Field mapping to match exact frontend field names
const FIELD_MAPPINGS = {
  equipmentid: ['equipment', 'equipmentid', 'equipment_id', 'equipment id'],
  materialdescription: [
    'material description',
    'materialdescription',
    'material_description',
    'description',
    'product_description'
  ],
  serialnumber: [
    'serial number',
    'serialnumber',
    'serial_number',
    'serial',
    'sn'
  ],
  materialcode: [
    'material code',
    'materialcode',
    'material_code',
    'part_number',
    'partnumber',
    'part number'
  ],
  currentcustomer: [
    'current customer',
    'currentcustomer',
    'current_customer',
    'customer_code',
    'customercode',
    'customer'
  ],
  endcustomer: [
    'end customer',
    'endcustomer',
    'end_customer',
    'final_customer',
    'end_user'
  ],
  custWarrantystartdate: [
    'custwarrantystart',
    'custwarrantystartdate',
    'cust_warranty_start_date',
    'warranty_start',
    'warranty start date',
    'customer warranty start'
  ],
  custWarrantyenddate: [
    'custwarrantyend',
    'custwarrantyenddate',
    'cust_warranty_end_date',
    'warranty_end',
    'warranty end date',
    'customer warranty end'
  ],
  dealerwarrantystartdate: [
    'dealerwarrantystart',
    'dealerwarrantystartdate',
    'dealer_warranty_start_date',
    'dealer warranty start',
    'extended warranty start'
  ],
  dealerwarrantyenddate: [
    'dealerwarrantyend',
    'dealerwarrantyenddate',
    'dealer_warranty_end_date',
    'dealer warranty end',
    'extended warranty end'
  ],
  dealer: [
    'dealer',
    'dealer_name',
    'dealer name',
    'distributor',
    'partner'
  ],
  palnumber: [
    'pal number',
    'palnumber',
    'pal_number',
    'pal no',
    'pal_no'
  ],
  installationreportno: [
    'ir number',
    'irnumber',
    'ir_number',
    'installationreportno',
    'installation_report_no',
    'installation report no',
    'installation_no',
    'install_report_no'
  ]
};

/** Generate unique equipment ID */
function generateEquipmentId(serialnumber, materialcode) {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const cleanSerial = serialnumber.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6);
  const cleanMaterial = materialcode.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4);
  return `EQ_${cleanSerial}_${cleanMaterial}_${timestamp.slice(-8)}_${random}`.toUpperCase();
}

/** Normalize field names to match our schema */
function normalizeFieldNames(record) {
  const normalized = {};

  const recordKeysLower = {};
  Object.keys(record).forEach(key => {
    recordKeysLower[key.toLowerCase().trim()] = record[key];
  });

  for (const [standardField, variations] of Object.entries(FIELD_MAPPINGS)) {
    for (const variation of variations) {
      const variationLower = variation.toLowerCase().trim();

      const matchingKey = Object.keys(recordKeysLower).find(key => {
        const keyNormalized = key.replace(/[_\s]/g, '');
        const variationNormalized = variationLower.replace(/[_\s]/g, '');
        return key === variationLower || keyNormalized === variationNormalized;
      });

      if (matchingKey && recordKeysLower[matchingKey]) {
        normalized[standardField] = recordKeysLower[matchingKey];
        break;
      }
    }
  }

  return normalized;
}

/** 
 * FIXED: More lenient change detection to ensure PM generation
 * Only check for significant business field changes
 */
function getDetailedChanges(existingRecord, newRecord) {
  const fieldsToCompare = [
    'materialdescription',
    'materialcode',
    'currentcustomer',
    'endcustomer',
    'custWarrantystartdate',
    'custWarrantyenddate',
    'dealerwarrantystartdate',
    'dealerwarrantyenddate',
    'dealer'
  ];

  const changes = {};
  let hasChanges = false;

  for (const field of fieldsToCompare) {
    const existingValue = existingRecord[field];
    const newValue = newRecord[field];

    const existing = existingValue === null || existingValue === undefined || existingValue === '' ? '' : String(existingValue).trim();
    const incoming = newValue === null || newValue === undefined || newValue === '' ? '' : String(newValue).trim();

    if (existing !== incoming && !(existing === '' && incoming === '')) {
      changes[field] = {
        old: existing || null,
        new: incoming || null,
        fieldName: field
      };
      hasChanges = true;
    }
  }

  return { hasChanges, changes };
}

/** Parse different file types (Excel, CSV) */
async function parseFile(file) {
  const fileExtension = path.extname(file.originalname).toLowerCase();

  try {
    if (fileExtension === '.csv') {
      return parseCSVFile(file.buffer);
    } else if (['.xlsx', '.xls'].includes(fileExtension)) {
      return parseExcelFile(file.buffer);
    } else {
      throw new Error('Unsupported file format');
    }
  } catch (error) {
    throw new Error(`File parsing error: ${error.message}`);
  }
}

/** Parse CSV file with better handling */
function parseCSVFile(buffer) {
  return new Promise((resolve) => {
    const results = [];
    const csvString = buffer.toString('utf8');

    const lines = csvString.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return resolve([]);
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = [];
        let currentValue = '';
        let inQuotes = false;

        for (let j = 0; j < lines[i].length; j++) {
          const char = lines[i][j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim());

        const record = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });

        const normalizedRecord = normalizeFieldNames(record);
        if (Object.keys(normalizedRecord).length > 0) {
          results.push(normalizedRecord);
        }
      }
    }

    resolve(results);
  });
}

/** Parse Excel file */
function parseExcelFile(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  return jsonData
    .map(record => normalizeFieldNames(record))
    .filter(record => Object.keys(record).length > 0);
}

/** Universal date parser */
function parseUniversalDate(dateInput) {
  if (dateInput == null || dateInput === '') return null;

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

  if (typeof dateInput === 'string') {
    const dateOnly = dateInput.split(' ')[0];
    const formats = [
      'dd/MM/yyyy', 'dd-MM-yyyy', 'dd.MM.yyyy',
      'MM/dd/yyyy', 'MM-dd-yyyy', 'MM.dd.yyyy',
      'yyyy/MM/dd', 'yyyy-MM-dd', 'yyyy.MM.dd',
      'd/M/yyyy', 'd-M-yyyy', 'd.M.yyyy',
      'M/d/yyyy', 'M-d-yyyy', 'M.d.yyyy'
    ];

    for (const dateFormat of formats) {
      try {
        const parsedDate = parse(dateOnly, dateFormat, new Date());
        if (isValid(parsedDate)) {
          return parsedDate;
        }
      } catch {
        continue;
      }
    }

    const nativeDate = new Date(dateInput);
    if (!isNaN(nativeDate)) {
      return nativeDate;
    }
  }

  return null;
}

/** Convert date to ISO format */
function toISODateString(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return format(d, 'yyyy-MM-dd');
}

/** Get PM frequency in months from product master */
function getPMFrequencyMonths(frequency) {
  const freq = parseInt(frequency, 10);
  if (freq === 2) return 6;  // Twice per year
  if (freq === 4) return 3;  // 4 times per year  
  if (freq === 3) return 4;  // 3 times per year
  if (freq === 1) return 12; // Once per year
  if (freq === 6) return 2;  // 6 times per year
  return 6; // Default: twice per year
}

/** Calculate PM status based on due month and current date */
function calculatePMStatus(dueDateStr) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const [dueMonth, dueYear] = dueDateStr.split('/').map(Number);
  const diffMonths = (currentYear - dueYear) * 12 + (currentMonth - dueMonth);

  if (diffMonths <= 0) return 'Due';               // Current or future month
  if (diffMonths === 1) return 'Overdue';          // 1 month past
  if (diffMonths >= 2) return 'Lapsed';            // 2+ months past

  return 'Due';  
}

/** Generate PM due date and month */
function generatePMDueInfo(startDate, intervalMonths, sequenceNumber) {
  const dueDate = addMonths(startOfMonth(startDate), (sequenceNumber - 1) * intervalMonths);
  return {
    dueDate: toISODateString(dueDate),
    dueMonth: format(dueDate, 'MM/yyyy')
  };
}

const BATCH_SIZE = 500;
const PM_BATCH_SIZE = 2000;

router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  const response = {
    status: 'processing',
    startTime: new Date(),
    fileName: req.file?.originalname || 'Unknown',
    fileType: req.file ? path.extname(req.file.originalname).toUpperCase() : 'Unknown',
    totalRecords: 0,
    processedRecords: 0,
    equipmentResults: [],
    pmResults: [],
    summary: {
      totalPMExpected: 0,
      totalPMCreated: 0,
      pmCompletionPercentage: 0,
      statusBreakdown: {
        Due: 0,
        Overdue: 0,
        Lapsed: 0
      },
      pmTypeBreakdown: {
        WPM: 0,
        EPM: 0,
        CPM: 0,
        NPM: 0
      },
      operationBreakdown: {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0
      }
    },
    errors: [],
    warnings: [],
    fieldMappingInfo: {
      detectedFields: [],
      mappedFields: [],
      unmappedFields: []
    }
  };

  try {
    if (!req.file) {
      response.status = 'failed';
      response.errors.push('No file uploaded');
      return res.status(400).json(response);
    }

    // Parse input file
    let jsonData;
    try {
      jsonData = await parseFile(req.file);
    } catch (parseError) {
      response.status = 'failed';
      response.errors.push(`File parsing failed: ${parseError.message}`);
      return res.status(400).json(response);
    }



    response.totalRecords = jsonData.length;

    if (jsonData.length === 0) {
      response.status = 'failed';
      response.errors.push('No valid data found in file');
      return res.status(400).json(response);
    }

    const firstRecord = jsonData[0];
    response.fieldMappingInfo.detectedFields = Object.keys(firstRecord);
    response.fieldMappingInfo.mappedFields = Object.keys(firstRecord).filter(key =>
      Object.values(FIELD_MAPPINGS).some(variations =>
        variations.some(variation =>
          key.toLowerCase().trim() === variation.toLowerCase() ||
          key.toLowerCase().replace(/[_\s]/g, '') === variation.toLowerCase().replace(/[_\s]/g, '')
        )
      )
    );
    response.fieldMappingInfo.unmappedFields = response.fieldMappingInfo.detectedFields.filter(
      field => !response.fieldMappingInfo.mappedFields.includes(field)
    );

    const requiredFields = ['materialcode', 'serialnumber', 'materialdescription', 'currentcustomer', 'endcustomer', 'custWarrantystartdate', 'custWarrantyenddate', 'dealer'];
    const missingFields = requiredFields.filter(field => !firstRecord.hasOwnProperty(field) || !firstRecord[field]);

    if (missingFields.length > 0) {
      response.warnings.push(`Some required fields are missing: ${missingFields.join(', ')}. Records with missing data will be skipped.`);
    }

    const [materialcodes, customercodes, serialnumbers] = jsonData.reduce(
      (acc, record) => {
        if (record.materialcode) acc[0].add(record.materialcode);
        if (record.currentcustomer) acc[1].add(record.currentcustomer);
        if (record.serialnumber) acc[2].add(record.serialnumber);
        return acc;
      },
      [new Set(), new Set(), new Set()]
    );

    const [products, customers, amcContracts, existingEquipment] = await Promise.all([
      Product.find({ partnoid: { $in: [...materialcodes] } }),
      Customer.find({ customercodeid: { $in: [...customercodes] } }),
      AMCContract.find({ serialnumber: { $in: [...serialnumbers] } }),
      Equipment.find({ serialnumber: { $in: [...serialnumbers] } })
    ]);
    const productMap = new Map(products.map(p => [p.partnoid, p]));

    const customerMap = buildNormalizedCustomerMap(customers);

    const amcMap = new Map(amcContracts.map(a => [a.serialnumber, a]));
    const existingEquipmentMap = new Map(existingEquipment.map(e => [e.serialnumber, e]));

    const validRecords = [];
    const recordsToUpdate = [];
    const recordsToCreate = [];
    const recordsForPMGeneration = [];
    const processedSerials = new Set();

    console.log(`Processing ${jsonData.length} records`);

    for (const record of jsonData) {
      if (processedSerials.has(record.serialnumber)) {
        response.equipmentResults.push({
          serialnumber: record.serialnumber,
          status: 'Failed',
          reason: 'Duplicate serial number in uploaded file',
          error: 'Serial number appears multiple times in the file'
        });
        response.summary.operationBreakdown.failed++;
        continue;
      }

      const hasRequiredFields = requiredFields.every(field => record[field] && record[field].toString().trim());

      if (!hasRequiredFields) {
        response.equipmentResults.push({
          serialnumber: record.serialnumber || 'Unknown',
          status: 'Failed',
          reason: 'Missing required fields',
          error: `Missing: ${requiredFields.filter(field => !record[field] || !record[field].toString().trim()).join(', ')}`
        });
        response.summary.operationBreakdown.failed++;
        continue;
      }

      try {
        const processedRecord = { ...record };

        const dateFields = ['custWarrantystartdate', 'custWarrantyenddate', 'dealerwarrantystartdate', 'dealerwarrantyenddate'];
        dateFields.forEach(field => {
          if (processedRecord[field]) {
            const parsedDate = parseUniversalDate(processedRecord[field]);
            processedRecord[field] = parsedDate ? toISODateString(parsedDate) : null;
          }
        });

        const existingRecord = existingEquipmentMap.get(processedRecord.serialnumber);

        if (existingRecord) {
          processedRecord.status = existingRecord.status;
          processedRecord.equipmentid = existingRecord.equipmentid;
          processedRecord.createdAt = existingRecord.createdAt;
          processedRecord.modifiedAt = new Date();

          const changeAnalysis = getDetailedChanges(existingRecord.toObject(), processedRecord);

          if (changeAnalysis.hasChanges) {
            recordsToUpdate.push(processedRecord);
            recordsForPMGeneration.push(processedRecord);

            response.equipmentResults.push({
              serialnumber: processedRecord.serialnumber,
              equipmentid: processedRecord.equipmentid,
              status: 'Updated',
              reason: 'Data changes detected',
              changedFields: Object.keys(changeAnalysis.changes),
              detailedChanges: changeAnalysis.changes,
              changeCount: Object.keys(changeAnalysis.changes).length,
              previousModified: existingRecord.modifiedAt,
              willGeneratePMs: true,
              error: null
            });
          } else {
            recordsForPMGeneration.push(processedRecord);

            response.equipmentResults.push({
              serialnumber: processedRecord.serialnumber,
              equipmentid: existingRecord.equipmentid,
              status: 'PM_Regenerated',
              reason: 'No equipment changes but PMs will be regenerated',
              lastModified: existingRecord.modifiedAt,
              willGeneratePMs: true,
              error: null
            });
          }
        } else {
          processedRecord.equipmentid = processedRecord.serialnumber;
          processedRecord.status = 'Active';
          processedRecord.createdAt = new Date();
          processedRecord.modifiedAt = new Date();

          recordsToCreate.push(processedRecord);
          recordsForPMGeneration.push(processedRecord);

          response.equipmentResults.push({
            serialnumber: processedRecord.serialnumber,
            equipmentid: processedRecord.equipmentid,
            status: 'Created',
            reason: 'New equipment record',
            willGeneratePMs: true,
            error: null
          });
        }

        validRecords.push(processedRecord);
        processedSerials.add(processedRecord.serialnumber);

      } catch (error) {
        response.equipmentResults.push({
          serialnumber: record.serialnumber || 'Unknown',
          status: 'Failed',
          reason: 'Processing error',
          error: error.message
        });
        response.summary.operationBreakdown.failed++;
      }
    }

    console.log(`Records for PM generation: ${recordsForPMGeneration.length}`);

    // CREATE Equipment documents
    if (recordsToCreate.length > 0) {
      for (let i = 0; i < recordsToCreate.length; i += BATCH_SIZE) {
        const batch = recordsToCreate.slice(i, i + BATCH_SIZE);
        try {
          await Equipment.insertMany(batch, { ordered: false });
          response.summary.operationBreakdown.created += batch.length;
        } catch (bulkError) {
          if (bulkError.writeErrors) {
            bulkError.writeErrors.forEach(err => {
              const index = err.index;
              if (batch[index]) {
                const serialnumber = batch[index].serialnumber;
                const errorResult = response.equipmentResults.find(r => r.serialnumber === serialnumber);
                if (errorResult) {
                  errorResult.status = 'Failed';
                  errorResult.error = err.errmsg || 'Database write error';
                  errorResult.willGeneratePMs = false;
                  response.summary.operationBreakdown.failed++;
                }
              }
            });
          }
        }
      }
    }

    // UPDATE Equipment documents
    if (recordsToUpdate.length > 0) {
      for (let i = 0; i < recordsToUpdate.length; i += BATCH_SIZE) {
        const batch = recordsToUpdate.slice(i, i + BATCH_SIZE);
        const equipmentOps = batch.map(record => ({
          updateOne: {
            filter: { serialnumber: record.serialnumber },
            update: { $set: record }
          }
        }));

        try {
          const result = await Equipment.bulkWrite(equipmentOps, { ordered: false });
          response.summary.operationBreakdown.updated += result.modifiedCount;
        } catch (bulkError) {
          if (bulkError.writeErrors) {
            bulkError.writeErrors.forEach(err => {
              const index = err.index;
              if (batch[index]) {
                const serialnumber = batch[index].serialnumber;
                const errorResult = response.equipmentResults.find(r => r.serialnumber === serialnumber);
                if (errorResult) {
                  errorResult.status = 'Failed';
                  errorResult.error = err.errmsg || 'Database write error';
                  errorResult.willGeneratePMs = false;
                  response.summary.operationBreakdown.failed++;
                }
              }
            });
          }
        }
      }
    }

    response.processedRecords = jsonData.length;

    console.log(`Starting PM generation for ${recordsForPMGeneration.length} records`);

    if (recordsForPMGeneration.length > 0) {
      const serialsForPMGeneration = recordsForPMGeneration.map(r => r.serialnumber);

      // Get all completed PMs (to skip duplicates)
      const completedPMs = await PM.find({
        serialNumber: { $in: serialsForPMGeneration },
        pmStatus: 'Completed'
      });

      const completedPMMap = new Map();
      completedPMs.forEach(pm => {
        if (!completedPMMap.has(pm.serialNumber)) {
          completedPMMap.set(pm.serialNumber, new Set());
        }
        completedPMMap.get(pm.serialNumber).add(pm.pmType);
      });

      // Remove old non-completed PMs
      await PM.deleteMany({
        serialNumber: { $in: serialsForPMGeneration },
        pmStatus: { $ne: 'Completed' }
      });

      console.log(`Deleted old PMs for ${serialsForPMGeneration.length} serials`);

      // Generate new PMs
      const allPMs = [];

      for (const record of recordsForPMGeneration) {
        try {
          const serialnumber = record.serialnumber;
          const product = productMap.get(record.materialcode);

          if (!product || !product.frequency) {
            response.warnings.push(`No product frequency found for serial ${serialnumber} - materialcode: ${record.materialcode}`);
            continue;
          }

          const customerCode = String(record.currentcustomer || '').trim().toLowerCase();
          const customer = customerMap.get(customerCode);

          const amc = amcMap.get(serialnumber);
          const frequencyMonths = getPMFrequencyMonths(product.frequency);

          console.log(`Generating PMs for ${serialnumber}, frequency: ${frequencyMonths} months, product: ${product.partnoid}`);

          // 1. Customer Warranty PMs
          if (record.custWarrantystartdate && record.custWarrantyenddate) {
            const startDate = parseUniversalDate(record.custWarrantystartdate);
            const endDate = parseUniversalDate(record.custWarrantyenddate);

            if (startDate && endDate) {
              const totalMonths = differenceInMonths(endDate, startDate) + 1;
              const numberOfPMs = Math.floor(totalMonths / frequencyMonths);
              response.summary.totalPMExpected += numberOfPMs;

              console.log(`Creating ${numberOfPMs} warranty PMs for ${serialnumber} (${totalMonths} months, ${frequencyMonths} interval)`);

              for (let i = 1; i <= numberOfPMs; i++) {
                const pmType = `WPM${String(i).padStart(2, '0')}`;
                if (completedPMMap.has(serialnumber) && completedPMMap.get(serialnumber).has(pmType)) continue;


                const { dueDate, dueMonth } = generatePMDueInfo(startDate, frequencyMonths, i);
                const pmStatus = calculatePMStatus(dueMonth);

                // CREATE ALL PMs including Lapsed
                allPMs.push({
                  pmType,
                  materialDescription: record.materialdescription || '',
                  serialNumber: serialnumber,
                  customerCode: record.currentcustomer || '',
                  region: customer?.region || '',
                  city: customer?.city || '',
                  branch: customer?.branch || '',
                  pmDueDate: dueDate,
                  pmDueMonth: dueMonth,
                  pmStatus,
                  partNumber: record.materialcode || '',
                  frequency: frequencyMonths,
                  equipmentId: record.equipmentid,
                  createdAt: new Date(),
                  updatedAt: new Date()
                });

                response.summary.statusBreakdown[pmStatus]++;
                response.summary.pmTypeBreakdown.WPM++;
              }
            }
          }

          // 2. Extended/Dealer Warranty PMs
          if (record.dealerwarrantystartdate && record.dealerwarrantyenddate) {
            const startDate = parseUniversalDate(record.dealerwarrantystartdate);
            const endDate = parseUniversalDate(record.dealerwarrantyenddate);

            if (startDate && endDate) {
              const totalMonths = differenceInMonths(endDate, startDate) + 1;
              const numberOfPMs = Math.floor(totalMonths / frequencyMonths);
              response.summary.totalPMExpected += numberOfPMs;

              for (let i = 1; i <= numberOfPMs; i++) {
                const pmType = `EPM${String(i).padStart(2, '0')}`;
                if (completedPMMap.has(serialnumber) && completedPMMap.get(serialnumber).has(pmType)) continue;

                const { dueDate, dueMonth } = generatePMDueInfo(startDate, frequencyMonths, i);
                const pmStatus = calculatePMStatus(dueMonth);

                // CREATE ALL PMs including Lapsed
                allPMs.push({
                  pmType,
                  materialDescription: record.materialdescription || '',
                  serialNumber: serialnumber,
                  customerCode: record.currentcustomer || '',
                  region: customer?.region || '',
                  city: customer?.city || '',
                  branch: customer?.branch || '',
                  pmDueDate: dueDate,
                  pmDueMonth: dueMonth,
                  pmStatus,
                  partNumber: record.materialcode || '',
                  frequency: frequencyMonths,
                  equipmentId: record.equipmentid,
                  createdAt: new Date(),
                  updatedAt: new Date()
                });

                response.summary.statusBreakdown[pmStatus]++;
                response.summary.pmTypeBreakdown.EPM++;
              }
            }
          }

          // 3. AMC Contract PMs
          if (amc && amc.startdate && amc.enddate) {
            const startDate = parseUniversalDate(amc.startdate);
            const endDate = parseUniversalDate(amc.enddate);

            if (startDate && endDate) {
              let pmPrefix = '';
              if (amc.satypeZDRC_ZDRN?.toUpperCase() === 'ZDRC') pmPrefix = 'CPM';
              else if (amc.satypeZDRC_ZDRN?.toUpperCase() === 'ZDRN') pmPrefix = 'NPM';

              if (pmPrefix) {
                const totalMonths = differenceInMonths(endDate, startDate) + 1;
                const numberOfPMs = Math.floor(totalMonths / frequencyMonths);
                response.summary.totalPMExpected += numberOfPMs;

                for (let i = 1; i <= numberOfPMs; i++) {
                  const pmType = `${pmPrefix}${String(i).padStart(2, '0')}`;
                  if (completedPMMap.has(serialnumber) && completedPMMap.get(serialnumber).has(pmType)) continue;

                  const { dueDate, dueMonth } = generatePMDueInfo(startDate, frequencyMonths, i);
                  const pmStatus = calculatePMStatus(dueMonth);

                  // CREATE ALL PMs including Lapsed
                  allPMs.push({
                    pmType,
                    materialDescription: record.materialdescription || '',
                    serialNumber: serialnumber,
                    customerCode: record.currentcustomer || '',
                    region: customer?.region || '',
                    city: customer?.city || '',
                    branch: customer?.branch || '',
                    pmDueDate: dueDate,
                    pmDueMonth: dueMonth,
                    pmStatus,
                    partNumber: record.materialcode || '',
                    frequency: frequencyMonths,
                    equipmentId: record.equipmentid,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  });

                  response.summary.statusBreakdown[pmStatus]++;
                  if (pmPrefix === 'CPM') response.summary.pmTypeBreakdown.CPM++;
                  if (pmPrefix === 'NPM') response.summary.pmTypeBreakdown.NPM++;
                }
              }
            }
          }

        } catch (pmError) {
          console.error(`PM generation error for ${record.serialnumber}:`, pmError);
          response.errors.push(`PM generation error for ${record.serialnumber}: ${pmError.message}`);
        }
      }

      console.log(`Generated ${allPMs.length} PM tasks for insertion`);

      let pmInsertedCount = 0;
      for (let i = 0; i < allPMs.length; i += PM_BATCH_SIZE) {
        const pmBatch = allPMs.slice(i, i + PM_BATCH_SIZE);
        try {
          const insertedPMs = await PM.insertMany(pmBatch, { ordered: false });
          pmInsertedCount += insertedPMs.length;

          insertedPMs.forEach(pm => {
            response.pmResults.push({
              serialnumber: pm.serialNumber,
              equipmentId: pm.equipmentId,
              pmType: pm.pmType,
              dueMonth: pm.pmDueMonth,
              dueDate: pm.pmDueDate,
              status: pm.pmStatus,
              created: 'Success'
            });
          });

        } catch (insertError) {
          console.error('PM insert error:', insertError);
          response.errors.push(`PM insert error: ${insertError.message}`);

          pmBatch.forEach(pm => {
            response.pmResults.push({
              serialnumber: pm.serialNumber,
              equipmentId: pm.equipmentId,
              pmType: pm.pmType,
              dueMonth: pm.pmDueMonth,
              status: pm.pmStatus,
              created: 'Failed',
              error: insertError.message
            });
          });
        }
      }

      response.summary.totalPMCreated = pmInsertedCount;
      console.log(`Successfully inserted ${pmInsertedCount} PM tasks out of ${allPMs.length} generated`);
    }

    // Update operation breakdown to reflect PM regeneration
    const pmRegeneratedCount = response.equipmentResults.filter(r => r.status === 'PM_Regenerated').length;
    response.summary.operationBreakdown.skipped = pmRegeneratedCount;

    response.summary.pmCompletionPercentage = response.summary.totalPMExpected > 0 ?
      Math.round((response.summary.totalPMCreated / response.summary.totalPMExpected) * 100) : 100;

    response.warnings.push(
      `Final Summary: ${response.summary.operationBreakdown.created} created, ` +
      `${response.summary.operationBreakdown.updated} updated, ` +
      `${pmRegeneratedCount} PM regenerated, ` +
      `${response.summary.operationBreakdown.failed} failed. ` +
      `Generated ${response.summary.totalPMCreated} PMs from ${response.summary.totalPMExpected} expected.`
    );

    response.status = 'completed';
    response.endTime = new Date();
    response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;

    return res.json(response);

  } catch (error) {
    console.error('Bulk upload error:', error);
    response.status = 'failed';
    response.endTime = new Date();
    response.errors.push(error.message);
    response.duration = response.endTime ?
      `${((response.endTime - response.startTime) / 1000).toFixed(2)}s` : '0s';
    return res.status(500).json(response);
  }
});

module.exports = router;
