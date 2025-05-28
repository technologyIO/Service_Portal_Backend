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

// Create an in-memory store for job tracking
const jobStore = new Map();

// Cleanup job store every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of jobStore.entries()) {
    if (job.status === 'completed' || job.status === 'failed') {
      // Remove jobs that completed more than 5 minutes ago
      if (now - job.completedAt > 300000) {
        jobStore.delete(jobId);
      }
    }
  }
}, 300000);

// Progress tracking endpoint
router.get('/progress/:jobId', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const { jobId } = req.params;
  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Initial check if job exists
  if (!jobStore.has(jobId)) {
    sendEvent({ error: 'Job not found' });
    res.end();
    return;
  }

  // Send initial state
  sendEvent(jobStore.get(jobId));

  // If job is already completed, end immediately
  const job = jobStore.get(jobId);
  if (job.status === 'completed' || job.status === 'failed') {
    res.end();
    return;
  }

  // Set up periodic updates
  const intervalId = setInterval(() => {
    const currentJob = jobStore.get(jobId);
    if (!currentJob) {
      clearInterval(intervalId);
      sendEvent({ error: 'Job removed' });
      res.end();
      return;
    }

    sendEvent(currentJob);

    // End connection if job completed
    if (currentJob.status === 'completed' || currentJob.status === 'failed') {
      clearInterval(intervalId);
      res.end();
    }
  }, 1000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(intervalId);
  });
});

// Bulk upload route
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  let jobId;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Generate unique job ID
    jobId = new mongoose.Types.ObjectId().toString();
    const startTime = Date.now();

    // Initialize job tracking
    const job = {
      jobId,
      status: 'processing',
      startTime,
      totalEquipment: 0,
      processedEquipment: 0,
      equipmentResults: [],
      pmResults: [],
      summary: {
        totalPMExpected: 0,
        totalPMCreated: 0,
        pmCompletionPercentage: 0
      }
    };
    jobStore.set(jobId, job);

    // Read and parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    // Update job with total equipment count
    job.totalEquipment = jsonData.length;
    jobStore.set(jobId, job);

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

    // Process equipment sequentially with progress updates
    for (let i = 0; i < jsonData.length; i++) {
      const record = jsonData[i];
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

        const status = equipment.wasCreated ? 'Created' : 'Updated';
        job.equipmentResults.push({
          serialnumber: processedRecord.serialnumber,
          status,
          error: null
        });

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
              job.summary.totalPMExpected += numBase;

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
              job.summary.totalPMExpected += numDealer;

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
              job.summary.totalPMExpected += numAMC;

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
          job.summary.totalPMCreated += inserted.length;

          inserted.forEach(pm => {
            job.pmResults.push({
              serialnumber: pm.serialNumber,
              pmType: pm.pmType,
              status: 'Created',
              error: null
            });
          });
        }

        // Update progress
        job.processedEquipment = i + 1;
        job.summary.pmCompletionPercentage = job.summary.totalPMExpected > 0
          ? Math.round((job.summary.totalPMCreated / job.summary.totalPMExpected) * 100)
          : 100;

        // Update job store every 10 records or last record
        if (i % 10 === 0 || i === jsonData.length - 1) {
          jobStore.set(jobId, job);
        }

      } catch (err) {
        job.equipmentResults.push({
          serialnumber: record.serialnumber || 'Unknown',
          status: 'Failed',
          error: err.message
        });
        jobStore.set(jobId, job);
      }
    }

    // Finalize job
    job.status = 'completed';
    job.completedAt = Date.now();
    job.duration = `${((job.completedAt - startTime) / 1000).toFixed(2)}s`;
    jobStore.set(jobId, job);

    return res.status(200).json({ jobId });

  } catch (error) {
    console.error('Bulk upload error:', error);

    // If job exists, update its status
    if (jobId) {
      const job = jobStore.get(jobId) || {};
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = Date.now();
      jobStore.set(jobId, job);
    }

    return res.status(500).json({
      error: 'Server Error',
      details: error.message,
      ...(jobId && { jobId })
    });
  }
});

module.exports = router;