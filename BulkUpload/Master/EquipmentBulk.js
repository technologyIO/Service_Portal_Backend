const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');

// Import Mongoose models
const Equipment = require('../../Model/MasterSchema/EquipmentSchema');
const PM = require('../../Model/UploadSchema/PMSchema');
const Product = require('../../Model/MasterSchema/ProductSchema');
const AMCContract = require('../../Model/UploadSchema/AMCContractSchema');
const Customer = require('../../Model/UploadSchema/CustomerSchema');

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

/** Convert Excel serial date to JS Date */
function excelDateToJSDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractionalDay = serial - Math.floor(serial);
  const totalSeconds = Math.floor(86400 * fractionalDay);
  dateInfo.setSeconds(dateInfo.getSeconds() + totalSeconds);
  return dateInfo;
}

/** Parse either a numeric Excel date or a standard date string */
function parseExcelDate(value) {
  if (value == null) return null;
  if (typeof value === 'number') {
    return excelDateToJSDate(value);
  }
  if (typeof value === 'string') {
    const num = Number(value);
    if (!isNaN(num)) {
      return excelDateToJSDate(num);
    }
    let d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    d = new Date(value.replace(/-/g, '/'));
    if (!isNaN(d.getTime())) return d;
    if (value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 3 && parts[0].length === 2) {
        d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }
  return null;
}

/** Add months to a date */
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Compute PM due month string (MM/YYYY)
 * monthsToAdd is the scheduled interval; due is one month before.
 */
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
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    let equipmentResults = [];
    let pmResults = [];
    let totalEquipment = jsonData.length;
    let processedEquipment = 0;
    let totalPMExpected = 0;
    let totalPMCreated = 0;

    for (let record of jsonData) {
      // ─────────────────────────────────────────────────────────────
      // Normalize date fields to "YYYY-MM-DD" strings
      const dateFields = [
        'custWarrantystartdate',
        'custWarrantyenddate',       // ← added so end date is normalized too
        'dealerwarrantystartdate',
        'dealerwarrantyenddate'
      ];
      for (const field of dateFields) {
        if (record[field] != null) {
          const parsed = parseExcelDate(record[field]);
          if (parsed) {
            record[field] = parsed.toISOString().split('T')[0];
          }
        }
      }
      // ─────────────────────────────────────────────────────────────

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

      // Remove non-completed PMs, keep completed
      await PM.deleteMany({
        serialNumber: equipmentDoc.serialnumber,
        pmStatus: { $ne: 'Completed' }
      });
      const completedPMs = await PM.find({
        serialNumber: equipmentDoc.serialnumber,
        pmStatus: 'Completed'
      });

      // Look up product frequency
      const product = await Product.findOne({ partnoid: equipmentDoc.materialcode }).catch(() => null);
      // Look up customer for region/city
      const customer = await Customer.findOne({ customercodeid: equipmentDoc.currentcustomer }).catch(() => null);

      if (product && ['3', '6', '12'].includes(product.frequency)) {
        const freq = parseInt(product.frequency, 10);

        // ─── Base Warranty PMs (WPM) ──────────────────────────────
        const numBase = Math.floor(12 / freq);
        totalPMExpected += numBase;
        if (equipmentDoc.custWarrantystartdate) {
          const baseDate = parseExcelDate(equipmentDoc.custWarrantystartdate) ||
                           new Date(equipmentDoc.custWarrantystartdate);
          if (baseDate && !isNaN(baseDate)) {
            for (let j = 1; j <= numBase; j++) {
              const type = `WPM${String(j).padStart(2,'0')}`;
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
          const start = parseExcelDate(equipmentDoc.dealerwarrantystartdate);
          const end   = parseExcelDate(equipmentDoc.dealerwarrantyenddate);
          if (start && end && !isNaN(start) && !isNaN(end)) {
            const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 +
                               (end.getMonth() - start.getMonth()) + 1;
            const numDealer = Math.floor(diffMonths / freq);
            totalPMExpected += numDealer;
            for (let j = 1; j <= numDealer; j++) {
              const type = `EPM${String(j).padStart(2,'0')}`;
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
          const start = parseExcelDate(amc.startdate) || new Date(amc.startdate);
          const end   = parseExcelDate(amc.enddate)   || new Date(amc.enddate);
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
                const type = `${prefix}${String(j).padStart(2,'0')}`;
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
    return res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
