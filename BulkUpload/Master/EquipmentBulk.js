const { parse, isValid } = require('date-fns');
const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');

// Import Mongoose models
const Equipment = require('../../Model/MasterSchema/EquipmentSchema');
const PM = require('../../Model/UploadSchema/PMSchema');
const Product = require('../../Model/MasterSchema/ProductSchema');
const AMCContract = require('../../Model/UploadSchema/AMCContractSchema');
const Customer = require('../../Model/UploadSchema/CustomerSchema');

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

/** 
 * Universal date parser supporting multiple formats and Excel serials
 * Returns Date object or null if invalid
 */
function parseUniversalDate(dateInput) {
  if (dateInput == null || dateInput === '') return null;

  // Handle Date instances
  if (dateInput instanceof Date && !isNaN(dateInput)) {
    return dateInput;
  }

  // Handle Excel serial numbers
  if (typeof dateInput === 'number') {
    try {
      const excelDate = XLSX.SSF.parse_date_code(dateInput);
      return new Date(excelDate.y, excelDate.m - 1, excelDate.d);
    } catch (e) {
      return null;
    }
  }

  // Handle string dates
  if (typeof dateInput === 'string') {
    // Clean the string first - remove any time portion
    const dateOnly = dateInput.split(' ')[0];

    // Try common formats
    const formats = [
      'dd/MM/yyyy', 'dd-MM-yyyy', 'dd.MM.yyyy',  // Indian formats
      'MM/dd/yyyy', 'MM-dd-yyyy', 'MM.dd.yyyy',  // US formats
      'yyyy/MM/dd', 'yyyy-MM-dd', 'yyyy.MM.dd',  // ISO formats
      'd/M/yyyy', 'd-M-yyyy', 'd.M.yyyy',        // Single digit day/month
      'M/d/yyyy', 'M-d-yyyy', 'M.d.yyyy'         // US single digit
    ];

    for (const format of formats) {
      try {
        const parsedDate = parse(dateOnly, format, new Date());
        if (isValid(parsedDate)) {
          return parsedDate;
        }
      } catch (e) {
        continue;
      }
    }

    // Try native Date parsing as fallback
    const nativeDate = new Date(dateInput);
    if (!isNaN(nativeDate)) {
      return nativeDate;
    }
  }

  return null;
}

/** Convert date to ISO format string (YYYY-MM-DD) */
function toISODateString(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** Add months to a date */
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Compute PM due month string (MM/YYYY) */
function computeDueMonth(baseDate, monthsToAdd) {
  const dueDate = addMonths(baseDate, monthsToAdd);
  const month = String(dueDate.getMonth() + 1).padStart(2, '0');
  const year = dueDate.getFullYear();
  return `${month}/${year}`;
}

// Bulk upload route
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  // Initialize response object
  const response = {
    status: 'processing',
    startTime: new Date(),
    totalRecords: 0,
    processedRecords: 0,
    equipmentResults: [],
    pmResults: [],
    summary: {
      totalPMExpected: 0,
      totalPMCreated: 0,
      pmCompletionPercentage: 0
    },
    errors: []
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

    // Read and parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    response.totalRecords = jsonData.length;

    // Send initial response
    res.write(JSON.stringify(response) + '\n');

    // Pre-fetch data for optimization
    const materialcodes = [...new Set(jsonData.map(r => r.materialcode))];
    const products = await Product.find({ partnoid: { $in: materialcodes } });
    const productMap = new Map(products.map(p => [p.partnoid, p]));

    const customercodes = [...new Set(jsonData.map(r => r.currentcustomer))];
    const customers = await Customer.find({ customercodeid: { $in: customercodes } });
    const customerMap = new Map(customers.map(c => [c.customercodeid, c]));

    const serialnumbers = jsonData.map(r => r.serialnumber);
    const amcContracts = await AMCContract.find({ serialnumber: { $in: serialnumbers } });
    const amcMap = new Map(amcContracts.map(a => [a.serialnumber, a]));

    // Process records in batches to avoid memory issues
    const BATCH_SIZE = 10;
    for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
      const batch = jsonData.slice(i, i + BATCH_SIZE);

      // Process each record in the batch
      for (const record of batch) {
        const equipmentResult = {
          serialnumber: record.serialnumber || 'Unknown',
          status: 'Processing',
          error: null
        };

        try {
          // Process dates
          const dateFields = [
            'custWarrantystartdate',
            'custWarrantyenddate',
            'dealerwarrantystartdate',
            'dealerwarrantyenddate'
          ];

          const processedRecord = { ...record };
          dateFields.forEach(field => {
            if (processedRecord[field]) {
              processedRecord[field] = toISODateString(parseUniversalDate(processedRecord[field]));
            }
          });

          // Upsert equipment
          const equipment = await Equipment.findOneAndUpdate(
            { serialnumber: processedRecord.serialnumber },
            processedRecord,
            { upsert: true, new: true, runValidators: true }
          );

          equipmentResult.status = equipment.wasCreated ? 'Created' : 'Updated';
          response.equipmentResults.push(equipmentResult);

          // Clean up non-completed PMs
          await PM.deleteMany({
            serialNumber: equipment.serialnumber,
            pmStatus: { $ne: 'Completed' }
          });

          const completedPMs = await PM.find({
            serialNumber: equipment.serialnumber,
            pmStatus: 'Completed'
          });

          // Generate PMs
          const product = productMap.get(equipment.materialcode);
          const customer = customerMap.get(equipment.currentcustomer);
          const amc = amcMap.get(equipment.serialnumber);

          const pmBatch = [];
          let pmCount = 0;

          if (product && ['3', '6', '12'].includes(product.frequency)) {
            const freq = parseInt(product.frequency, 10);

            // Base Warranty PMs
            if (equipment.custWarrantystartdate) {
              const baseDate = parseUniversalDate(equipment.custWarrantystartdate);
              if (baseDate) {
                const endDate = parseUniversalDate(equipment.custWarrantyenddate) || addMonths(baseDate, 12);
                const diffMonths = (endDate.getFullYear() - baseDate.getFullYear()) * 12 +
                  (endDate.getMonth() - baseDate.getMonth()) + 1;
                const numBase = Math.floor(diffMonths / freq);
                response.summary.totalPMExpected += numBase;

                for (let j = 1; j <= numBase; j++) {
                  const type = `WPM${String(j).padStart(2, '0')}`;
                  pmCount++;

                  if (!completedPMs.some(pm => pm.pmType === type)) {
                    const dueMonth = computeDueMonth(baseDate, (j - 1) * freq);
                    pmBatch.push({
                      pmType: type,
                      materialDescription: equipment.materialdescription,
                      serialNumber: equipment.serialnumber,
                      customerCode: equipment.currentcustomer,
                      region: customer?.region || '',
                      city: customer?.city || '',
                      pmDueMonth: dueMonth,
                      pmStatus: 'Due',
                      partNumber: equipment.materialcode
                    });
                  }
                }
              }
            }

            // Dealer Warranty PMs
            if (equipment.dealerwarrantystartdate && equipment.dealerwarrantyenddate) {
              const start = parseUniversalDate(equipment.dealerwarrantystartdate);
              const end = parseUniversalDate(equipment.dealerwarrantyenddate);

              if (start && end) {
                const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 +
                  (end.getMonth() - start.getMonth()) + 1;
                const numDealer = Math.floor(diffMonths / freq);
                response.summary.totalPMExpected += numDealer;

                for (let j = 1; j <= numDealer; j++) {
                  const type = `EPM${String(j).padStart(2, '0')}`;
                  pmCount++;

                  if (!completedPMs.some(pm => pm.pmType === type)) {
                    const dueMonth = computeDueMonth(start, (j - 1) * freq);
                    pmBatch.push({
                      pmType: type,
                      materialDescription: equipment.materialdescription,
                      serialNumber: equipment.serialnumber,
                      customerCode: equipment.currentcustomer,
                      region: customer?.region || '',
                      city: customer?.city || '',
                      pmDueMonth: dueMonth,
                      pmStatus: 'Due',
                      partNumber: equipment.materialcode
                    });
                  }
                }
              }
            }

            // AMC Contract PMs
            if (amc) {
              const start = parseUniversalDate(amc.startdate);
              const end = parseUniversalDate(amc.enddate);

              if (start && end) {
                const diffMonthsAMC = (end.getFullYear() - start.getFullYear()) * 12 +
                  (end.getMonth() - start.getMonth()) + 1;
                const numAMC = Math.floor(diffMonthsAMC / freq);
                response.summary.totalPMExpected += numAMC;

                const prefix = amc.satypeZDRC_ZDRN?.toUpperCase() === 'ZDRC'
                  ? 'CPM'
                  : amc.satypeZDRC_ZDRN?.toUpperCase() === 'ZDRN'
                    ? 'NPM'
                    : '';

                if (prefix) {
                  for (let j = 1; j <= numAMC; j++) {
                    const type = `${prefix}${String(j).padStart(2, '0')}`;
                    pmCount++;

                    if (!completedPMs.some(pm => pm.pmType === type)) {
                      const dueMonth = computeDueMonth(start, (j - 1) * freq);
                      pmBatch.push({
                        pmType: type,
                        materialDescription: equipment.materialdescription,
                        serialNumber: equipment.serialnumber,
                        customerCode: equipment.currentcustomer,
                        region: customer?.region || '',
                        city: customer?.city || '',
                        pmDueMonth: dueMonth,
                        pmStatus: 'Due',
                        partNumber: equipment.materialcode
                      });
                    }
                  }
                }
              }
            }
          }

          // Batch insert PMs
          if (pmBatch.length > 0) {
            const inserted = await PM.insertMany(pmBatch);
            response.summary.totalPMCreated += inserted.length;

            inserted.forEach(pm => {
              response.pmResults.push({
                serialnumber: pm.serialNumber,
                pmType: pm.pmType,
                status: 'Created',
                error: null
              });
            });
          }

          // Update progress
          response.processedRecords++;
          response.summary.pmCompletionPercentage = response.summary.totalPMExpected > 0
            ? Math.round((response.summary.totalPMCreated / response.summary.totalPMExpected) * 100)
            : 100;

        } catch (err) {
          equipmentResult.status = 'Failed';
          equipmentResult.error = err.message;
          response.equipmentResults.push(equipmentResult);
          response.processedRecords++;
          response.errors.push(`Error processing ${record.serialnumber}: ${err.message}`);
        }
      }

      // Send progress update after each batch
      res.write(JSON.stringify(response) + '\n');
    }

    // Finalize response
    response.status = 'completed';
    response.endTime = new Date();
    response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;
    res.write(JSON.stringify(response) + '\n');
    res.end();

  } catch (error) {
    console.error('Bulk upload error:', error);
    response.status = 'failed';
    response.endTime = new Date();
    response.errors.push(error.message);
    response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;
    return res.status(500).json(response);
  }
});
module.exports = router;