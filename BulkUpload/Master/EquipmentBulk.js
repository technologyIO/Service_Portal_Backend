const { parse, isValid } = require('date-fns');
const XLSX = require('xlsx');
const express = require('express');
const router = express.Router();
const multer = require('multer');

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
    // Clean the string first
    const cleanedDate = dateInput
      .replace(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/, '$1/$2/$3') // DD-MM-YYYY -> DD/MM/YYYY
      .replace(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/, '$2/$3/$1'); // YYYY-MM-DD -> MM/DD/YYYY

    const formats = [
      'dd/MM/yyyy', 'dd-MM-yyyy', 'dd.MM.yyyy',  // Indian formats
      'MM/dd/yyyy', 'MM-dd-yyyy', 'MM.dd.yyyy',  // US formats
      'yyyy/MM/dd', 'yyyy-MM-dd', 'yyyy.MM.dd',  // ISO formats
      'd/M/yyyy', 'd-M-yyyy', 'd.M.yyyy',        // Single digit day/month
      'M/d/yyyy', 'M-d-yyyy', 'M.d.yyyy',        // US single digit
      'yyyy-MM-dd\'T\'HH:mm:ss.SSSXXX'           // ISO with timezone
    ];

    for (const format of formats) {
      try {
        const parsedDate = parse(cleanedDate, format, new Date());
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
  const dueDate = addMonths(baseDate, monthsToAdd - 2);
  const month = String(dueDate.getMonth() + 1).padStart(2, '0');
  const year = dueDate.getFullYear();
  return `${month}/${year}`;
}

router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read the Excel workbook
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    let equipmentResults = [];
    let pmResults = [];
    let totalEquipment = jsonData.length;
    let processedEquipment = 0;
    let totalPMExpected = 0;
    let totalPMCreated = 0;

    for (let record of jsonData) {
      // Normalize date fields to ISO format strings
      const dateFields = [
        'custWarrantystartdate',
        'custWarrantyenddate',
        'dealerwarrantystartdate',
        'dealerwarrantyenddate'
      ];

      for (const field of dateFields) {
        if (record[field] != null) {
          const parsedDate = parseUniversalDate(record[field]);
          record[field] = toISODateString(parsedDate);
        }
      }

      // Process equipment record
      let equipmentDoc;
      try {
        const existing = await Equipment.findOne({ serialnumber: record.serialnumber });
        let status = 'Created';
        
        if (existing) {
          await Equipment.deleteOne({ _id: existing._id });
          status = 'Updated';
        }
        
        equipmentDoc = await new Equipment(record).save();
        equipmentResults.push({
          serialnumber: record.serialnumber,
          status
        });
      } catch (err) {
        equipmentResults.push({
          serialnumber: record.serialnumber,
          status: 'Failed',
          error: err.message
        });
        continue;
      }
      processedEquipment++;

      // Clean up existing PMs (keep only completed ones)
      await PM.deleteMany({
        serialNumber: equipmentDoc.serialnumber,
        pmStatus: { $ne: 'Completed' }
      });
      const completedPMs = await PM.find({
        serialNumber: equipmentDoc.serialnumber,
        pmStatus: 'Completed'
      });

      // Get product and customer info
      const product = await Product.findOne({ partnoid: equipmentDoc.materialcode }).catch(() => null);
      const customer = await Customer.findOne({ customercodeid: equipmentDoc.currentcustomer }).catch(() => null);

      if (product && ['3', '6', '12'].includes(product.frequency)) {
        const freq = parseInt(product.frequency, 10);

        // ─── Base Warranty PMs (WPM) ──────────────────────────────
        if (equipmentDoc.custWarrantystartdate) {
          const baseDate = parseUniversalDate(equipmentDoc.custWarrantystartdate);
          if (baseDate && !isNaN(baseDate)) {
            const numBase = Math.floor(12 / freq);
            totalPMExpected += numBase;
            
            for (let j = 1; j <= numBase; j++) {
              const type = `WPM${String(j).padStart(2, '0')}`;
              const exists = completedPMs.some(pm => pm.pmType === type);
              
              if (exists) {
                totalPMCreated++;
                pmResults.push({
                  serialnumber: equipmentDoc.serialnumber,
                  pmType: type,
                  status: 'Completed',
                  message: 'Already completed'
                });
              } else {
                const dueMonth = computeDueMonth(baseDate, j * freq);
                const pmData = {
                  pmType: type,
                  materialDescription: equipmentDoc.materialdescription,
                  serialNumber: equipmentDoc.serialnumber,
                  customerCode: equipmentDoc.currentcustomer,
                  region: customer?.region || '',
                  city: customer?.city || '',
                  pmDueMonth: dueMonth,
                  pmStatus: 'Due',
                  partNumber: equipmentDoc.materialcode
                };
                
                try {
                  await new PM(pmData).save();
                  totalPMCreated++;
                  pmResults.push({
                    serialnumber: equipmentDoc.serialnumber,
                    pmType: type,
                    status: 'Created'
                  });
                } catch (e) {
                  pmResults.push({
                    serialnumber: equipmentDoc.serialnumber,
                    pmType: type,
                    status: 'Failed',
                    error: e.message
                  });
                }
              }
            }
          }
        }

        // ─── Dealer Warranty PMs (EPM) ────────────────────────────
        if (equipmentDoc.dealerwarrantystartdate && equipmentDoc.dealerwarrantyenddate) {
          const start = parseUniversalDate(equipmentDoc.dealerwarrantystartdate);
          const end = parseUniversalDate(equipmentDoc.dealerwarrantyenddate);
          
          if (start && end && !isNaN(start) && !isNaN(end)) {
            const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 +
                              (end.getMonth() - start.getMonth()) + 1;
            const numDealer = Math.floor(diffMonths / freq);
            totalPMExpected += numDealer;
            
            for (let j = 1; j <= numDealer; j++) {
              const type = `EPM${String(j).padStart(2, '0')}`;
              const exists = completedPMs.some(pm => pm.pmType === type);
              
              if (exists) {
                totalPMCreated++;
                pmResults.push({
                  serialnumber: equipmentDoc.serialnumber,
                  pmType: type,
                  status: 'Completed',
                  message: 'Already completed'
                });
              } else {
                const dueMonth = computeDueMonth(start, j * freq);
                const pmData = {
                  pmType: type,
                  materialDescription: equipmentDoc.materialdescription,
                  serialNumber: equipmentDoc.serialnumber,
                  customerCode: equipmentDoc.currentcustomer,
                  region: customer?.region || '',
                  city: customer?.city || '',
                  pmDueMonth: dueMonth,
                  pmStatus: 'Due',
                  partNumber: equipmentDoc.materialcode
                };
                
                try {
                  await new PM(pmData).save();
                  totalPMCreated++;
                  pmResults.push({
                    serialnumber: equipmentDoc.serialnumber,
                    pmType: type,
                    status: 'Created'
                  });
                } catch (e) {
                  pmResults.push({
                    serialnumber: equipmentDoc.serialnumber,
                    pmType: type,
                    status: 'Failed',
                    error: e.message
                  });
                }
              }
            }
          }
        }

        // ─── AMC Contract PMs (CPM/NPM) ───────────────────────────
        const amc = await AMCContract.findOne({ serialnumber: equipmentDoc.serialnumber }).catch(() => null);
        if (amc) {
          const start = parseUniversalDate(amc.startdate);
          const end = parseUniversalDate(amc.enddate);
          
          if (start && end && !isNaN(start) && !isNaN(end)) {
            const diffMonthsAMC = (end.getFullYear() - start.getFullYear()) * 12 +
                                 (end.getMonth() - start.getMonth()) + 1;
            const numAMC = Math.floor(diffMonthsAMC / freq);
            totalPMExpected += numAMC;
            
            const prefix = (amc.satypeZDRC_ZDRN || '').toUpperCase() === 'ZDRC'
              ? 'CPM' : (amc.satypeZDRC_ZDRN || '').toUpperCase() === 'ZDRN'
              ? 'NPM' : '';
              
            if (prefix) {
              for (let j = 1; j <= numAMC; j++) {
                const type = `${prefix}${String(j).padStart(2, '0')}`;
                const exists = completedPMs.some(pm => pm.pmType === type);
                
                if (exists) {
                  totalPMCreated++;
                  pmResults.push({
                    serialnumber: equipmentDoc.serialnumber,
                    pmType: type,
                    status: 'Completed',
                    message: 'Already completed'
                  });
                } else {
                  const dueMonth = computeDueMonth(start, j * freq);
                  const pmData = {
                    pmType: type,
                    materialDescription: equipmentDoc.materialdescription,
                    serialNumber: equipmentDoc.serialnumber,
                    customerCode: equipmentDoc.currentcustomer,
                    region: customer?.region || '',
                    city: customer?.city || '',
                    pmDueMonth: dueMonth,
                    pmStatus: 'Due',
                    partNumber: equipmentDoc.materialcode
                  };
                  
                  try {
                    await new PM(pmData).save();
                    totalPMCreated++;
                    pmResults.push({
                      serialnumber: equipmentDoc.serialnumber,
                      pmType: type,
                      status: 'Created'
                    });
                  } catch (e) {
                    pmResults.push({
                      serialnumber: equipmentDoc.serialnumber,
                      pmType: type,
                      status: 'Failed',
                      error: e.message
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    const pmCompletionPercentage = totalPMExpected > 0
      ? Math.round((totalPMCreated / totalPMExpected) * 100)
      : 100;

    return res.status(200).json({
      totalEquipment,
      processedEquipment,
      equipmentResults,
      totalPMExpected,
      totalPMCreated,
      pmCompletionPercentage,
      pmResults
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Server Error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;