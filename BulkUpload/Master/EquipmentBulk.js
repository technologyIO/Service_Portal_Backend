const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');

// Import Mongoose models
const Equipment = require('../../Model/MasterSchema/EquipmentSchema');
const PM = require('../../Model/UploadSchema/PMSchema');
const Product = require('../../Model/MasterSchema/ProductSchema');
const AMCContract = require('../../Model/UploadSchema/AMCContractSchema');
// Import the Customer model from your Customer schema.
const Customer = require('../../Model/UploadSchema/CustomerSchema');

// Use Multer memory storage so that the file can be processed directly from memory.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * Convert an Excel serial date (number) to a JavaScript Date.
 * Excel stores dates as the number of days since January 1, 1900 (with an offset).
 *
 * @param {Number} serial - The Excel serial date.
 * @returns {Date} - The corresponding JavaScript Date.
 */
function excelDateToJSDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400; // seconds in a day
  const dateInfo = new Date(utcValue * 1000);
  // Handle fractional part (time portion)
  const fractionalDay = serial - Math.floor(serial);
  const totalSeconds = Math.floor(86400 * fractionalDay);
  dateInfo.setSeconds(dateInfo.getSeconds() + totalSeconds);
  return dateInfo;
}

/**
 * Helper function to parse a date value coming from Excel.
 * Accepts either a number (or numeric string) or a standard date string.
 *
 * @param {Number|String} value - The raw date value.
 * @returns {Date|null} - A valid Date object or null if conversion fails.
 */
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
    // Try direct conversion.
    let d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    // Try replacing dashes with slashes.
    d = new Date(value.replace(/-/g, '/'));
    if (!isNaN(d.getTime())) return d;
    // If the string appears to be in DD/MM/YYYY format, rearrange it.
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

/**
 * Helper function to add a specified number of months to a date.
 *
 * @param {Date} date - The starting date.
 * @param {Number} months - The number of months to add.
 * @returns {Date} - The resulting date.
 */
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Compute PM due month.
 * Scheduled maintenance is computed by adding months to the base date,
 * and the due date is one month before the scheduled date.
 * Returns a string in the format MM/YYYY.
 *
 * @param {Date} baseDate - The start date.
 * @param {Number} monthsToAdd - The interval (j * frequency) to add.
 * @returns {String} - The due month (MM/YYYY).
 */
function computeDueMonth(baseDate, monthsToAdd) {
  const dueDate = addMonths(baseDate, monthsToAdd - 2);
  const month = (dueDate.getMonth() + 1).toString().padStart(2, '0');
  const year = dueDate.getFullYear();
  return `${month}/${year}`;
}
/**
 * Bulk Upload API for Equipment with automatic creation of Preventive Maintenance (PM)
 * records for three situations:
 *
 *   1. Base warranty preventive PM (using custWarrantystartdate, prefix "WPM").
 *   2. Dealer warranty preventive PM (using dealerwarrantystartdate and dealerwarrantyenddate, prefix "EPM").
 *   3. AMC Contract preventive PM (if an AMCContract exists for the equipment’s serial number),
 *      where AMCContract.satypeZDRC_ZDRN determines the prefix:
 *        - "ZDRC" creates CPM records.
 *        - "ZDRN" creates NPM records.
 *
 * For each group the number of expected events is determined by the Product.frequency:
 *   - Frequency "3": 4 events per year (scheduled: 3,6,9,12 → due: 2,5,8,11)
 *   - Frequency "6": 2 events per year (scheduled: 6,12 → due: 5,11)
 *   - Frequency "12": 1 event per year (scheduled: 12 → due: 11)
 *
 * When the same equipment is re-uploaded, only PM records with a status other than "Completed"
 * are deleted and re-generated. Completed PM records are preserved and counted.
 */
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Read the Excel file from memory.
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

    for (const record of jsonData) {
      let equipmentDoc;
      try {
        const existingEquipment = await Equipment.findOne({ serialnumber: record.serialnumber });
        let equipStatus = 'Created';
        if (existingEquipment) {
          // Delete the old equipment record.
          await Equipment.deleteOne({ _id: existingEquipment._id });
          equipStatus = 'Updated';
        }
        equipmentDoc = await new Equipment(record).save();
        equipmentResults.push({ serialnumber: record.serialnumber, status: equipStatus });
      } catch (error) {
        equipmentResults.push({ serialnumber: record.serialnumber, status: 'Failed', error: error.message });
        continue; // Skip PM creation for this equipment.
      }
      processedEquipment++;

      // *** Preserve Completed PMs ***
      // Delete only PM records that are not "Completed".
      await PM.deleteMany({ serialNumber: equipmentDoc.serialnumber, pmStatus: { $ne: "Completed" } });
      // Retrieve the completed PM records for this equipment.
      const completedPMs = await PM.find({ serialNumber: equipmentDoc.serialnumber, pmStatus: "Completed" });

      // Fetch Product by matching material code.
      let product;
      try {
        product = await Product.findOne({ partnoid: equipmentDoc.materialcode });
      } catch (err) {
        console.error('Product lookup error for materialcode:', equipmentDoc.materialcode);
      }

      // ******** New: Lookup the Customer using currentcustomer code ********
      let customer = null;
      try {
        customer = await Customer.findOne({ customercodeid: equipmentDoc.currentcustomer });
      } catch (err) {
        console.error('Customer lookup error for customercode:', equipmentDoc.currentcustomer, err);
      }

      if (product && ['3', '6', '12'].includes(product.frequency)) {
        const frequencyValue = parseInt(product.frequency, 10);

        // ---------- Situation 1: Base Warranty PM (WPM) ----------
        const numPMBase = Math.floor(12 / frequencyValue);
        totalPMExpected += numPMBase;
        if (equipmentDoc.custWarrantystartdate) {
          const baseDate = parseExcelDate(equipmentDoc.custWarrantystartdate) || new Date(equipmentDoc.custWarrantystartdate);
          if (!baseDate || isNaN(baseDate.getTime())) {
            console.error(`Invalid custWarrantystartdate for serial ${equipmentDoc.serialnumber}: ${equipmentDoc.custWarrantystartdate}`);
          } else {
            for (let j = 1; j <= numPMBase; j++) {
              const currentType = "WPM" + j.toString().padStart(2, '0');
              // If a PM record for this event is already completed, skip creation.
              const exists = completedPMs.find(pm => pm.pmType === currentType);
              if (exists) {
                totalPMCreated++;
                pmResults.push({ serialnumber: equipmentDoc.serialnumber, pmType: currentType, status: "Completed", message: "Already completed" });
              } else {
                const dueMonth = computeDueMonth(baseDate, j * frequencyValue);
                const pmData = {
                  pmType: currentType,
                  pmNumber: "",
                  materialDescription: equipmentDoc.materialdescription,
                  serialNumber: equipmentDoc.serialnumber,
                  customerCode: equipmentDoc.currentcustomer,
                  region: "",
                  city: "",
                  pmDueMonth: dueMonth,
                  pmDoneDate: "",
                  pmVendorCode: "",
                  pmEngineerCode: "",
                  pmStatus: "Due",
                  partNumber: equipmentDoc.materialcode
                };
                // If a customer was found, update the empty fields.
                if (customer) {
                  pmData.city = customer.city;
                  pmData.region = customer.region;
                }
                if (!pmData.pmNumber) delete pmData.pmNumber;
                try {
                  await new PM(pmData).save();
                  totalPMCreated++;
                  pmResults.push({ serialnumber: equipmentDoc.serialnumber, pmType: currentType, status: "Created" });
                } catch (err) {
                  pmResults.push({ serialnumber: equipmentDoc.serialnumber, pmType: currentType, status: "Failed", error: err.message });
                }
              }
            }
          }
        }

        // ---------- Situation 2: Dealer Warranty PM (EPM) ----------
        if (equipmentDoc.dealerwarrantystartdate && equipmentDoc.dealerwarrantyenddate) {
          const dealerStart = parseExcelDate(equipmentDoc.dealerwarrantystartdate) || new Date(equipmentDoc.dealerwarrantystartdate);
          const dealerEnd = parseExcelDate(equipmentDoc.dealerwarrantyenddate) || new Date(equipmentDoc.dealerwarrantyenddate);
          if (dealerStart && !isNaN(dealerStart.getTime()) && dealerEnd && !isNaN(dealerEnd.getTime())) {
            const diffMonths = (dealerEnd.getFullYear() - dealerStart.getFullYear()) * 12 +
              (dealerEnd.getMonth() - dealerStart.getMonth()) + 1;
            const numPMDealer = Math.floor(diffMonths / frequencyValue);
            totalPMExpected += numPMDealer;
            for (let j = 1; j <= numPMDealer; j++) {
              const currentType = "EPM" + j.toString().padStart(2, '0');
              const exists = completedPMs.find(pm => pm.pmType === currentType);
              if (exists) {
                totalPMCreated++;
                pmResults.push({ serialnumber: equipmentDoc.serialnumber, pmType: currentType, status: "Completed", message: "Already completed" });
              } else {
                const dueMonth = computeDueMonth(dealerStart, j * frequencyValue);
                const pmData = {
                  pmType: currentType,
                  pmNumber: "",
                  materialDescription: equipmentDoc.materialdescription,
                  serialNumber: equipmentDoc.serialnumber,
                  customerCode: equipmentDoc.currentcustomer,
                  region: "",
                  city: "",
                  pmDueMonth: dueMonth,
                  pmDoneDate: "",
                  pmVendorCode: "",
                  pmEngineerCode: "",
                  pmStatus: "Due",
                  partNumber: equipmentDoc.materialcode
                };
                // Update with customer details if available.
                if (customer) {
                  pmData.city = customer.city;
                  pmData.region = customer.region;
                }
                if (!pmData.pmNumber) delete pmData.pmNumber;
                try {
                  await new PM(pmData).save();
                  totalPMCreated++;
                  pmResults.push({ serialnumber: equipmentDoc.serialnumber, pmType: currentType, status: "Created" });
                } catch (err) {
                  pmResults.push({ serialnumber: equipmentDoc.serialnumber, pmType: currentType, status: "Failed", error: err.message });
                }
              }
            }
          } else {
            console.error(`Invalid dealer warranty dates for serial ${equipmentDoc.serialnumber}`);
          }
        }

        // ---------- Situation 3: AMC Contract PM (CPM or NPM) ----------
        try {
          const amc = await AMCContract.findOne({ serialnumber: equipmentDoc.serialnumber });
          if (amc) {
            // For AMC dates, try our helper; if it fails, fallback to new Date().
            const amcStart = parseExcelDate(amc.startdate) || new Date(amc.startdate);
            const amcEnd = parseExcelDate(amc.enddate) || new Date(amc.enddate);
            if (amcStart && !isNaN(amcStart.getTime()) && amcEnd && !isNaN(amcEnd.getTime())) {
              const diffMonthsAMC = (amcEnd.getFullYear() - amcStart.getFullYear()) * 12 +
                (amcEnd.getMonth() - amcStart.getMonth()) + 1;
              const numPMAMC = Math.floor(diffMonthsAMC / frequencyValue);
              totalPMExpected += numPMAMC;
              let prefix = "";
              const amcType = (amc.satypeZDRC_ZDRN || "").toUpperCase();
              if (amcType === 'ZDRC') {
                prefix = "CPM";
              } else if (amcType === 'ZDRN') {
                prefix = "NPM";
              }
              if (prefix) {
                for (let j = 1; j <= numPMAMC; j++) {
                  const currentType = prefix + j.toString().padStart(2, '0');
                  const exists = completedPMs.find(pm => pm.pmType === currentType);
                  if (exists) {
                    totalPMCreated++;
                    pmResults.push({ serialnumber: equipmentDoc.serialnumber, pmType: currentType, status: "Completed", message: "Already completed" });
                  } else {
                    const dueMonth = computeDueMonth(amcStart, j * frequencyValue);
                    const pmData = {
                      pmType: currentType,
                      pmNumber: "",
                      materialDescription: equipmentDoc.materialdescription,
                      serialNumber: equipmentDoc.serialnumber,
                      customerCode: equipmentDoc.currentcustomer,
                      region: "",
                      city: "",
                      pmDueMonth: dueMonth,
                      pmDoneDate: "",
                      pmVendorCode: "",
                      pmEngineerCode: "",
                      pmStatus: "Due",
                      partNumber: equipmentDoc.materialcode
                    };
                    // Again, update with customer details if available.
                    if (customer) {
                      pmData.city = customer.city;
                      pmData.region = customer.region;
                    }
                    if (!pmData.pmNumber) delete pmData.pmNumber;
                    try {
                      await new PM(pmData).save();
                      totalPMCreated++;
                      pmResults.push({ serialnumber: equipmentDoc.serialnumber, pmType: currentType, status: "Created" });
                    } catch (err) {
                      pmResults.push({ serialnumber: equipmentDoc.serialnumber, pmType: currentType, status: "Failed", error: err.message });
                    }
                  }
                }
              }
            } else {
              console.error(`Invalid AMC contract dates for serial ${equipmentDoc.serialnumber}`);
            }
          }
        } catch (amcErr) {
          console.error("Error processing AMCContract for serial:", equipmentDoc.serialnumber, amcErr);
        }
      }
    } // End processing equipment records.

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
    console.error("Server error:", error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
