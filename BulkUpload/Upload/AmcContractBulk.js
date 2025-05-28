const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const AMCContract = require("../../Model/UploadSchema/AMCContractSchema"); // AMCContract model
const { parse, isValid } = require('date-fns');
const XLSX = require('xlsx');
// Multer memory storage ka istemal
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// POST /bulk-upload
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // 1. Pehle existing AMCContract documents ko delete karo
    const totalExisting = await AMCContract.countDocuments();
    let deletedCount = 0;

    if (totalExisting > 0) {
      // Saare documents ke _id fetch karo
      const docs = await AMCContract.find({}, { _id: 1 });
      // Ek-ek karke delete karo taki deletion progress track ho sake
      for (const doc of docs) {
        await AMCContract.deleteOne({ _id: doc._id });
        deletedCount++;
        // Agar aapko real-time progress chahiye to aap websockets ya SSE implement kar sakte hain.
      }
    }
    const deletionProgress = totalExisting === 0 ? 100 : Math.round((deletedCount / totalExisting) * 100);

    // 2. Ab excel file ko parse karke naye AMCContract records insert karo
    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
      dateNF: 'dd"/"mm"/"yyyy' // Specify possible date format
    });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    const totalRecords = jsonData.length;
    let processed = 0;
    const insertionResults = [];
    const parseUniversalDate = (dateInput) => {
      // If already a valid Date object
      if (dateInput instanceof Date && !isNaN(dateInput)) {
        return dateInput;
      }

      // If Excel serial number
      if (typeof dateInput === 'number') {
        const excelDate = XLSX.SSF.parse_date_code(dateInput);
        return new Date(excelDate.y, excelDate.m - 1, excelDate.d);
      }

      // Try multiple string formats
      const formats = [
        'dd/MM/yyyy', 'dd-MM-yyyy', 'dd.MM.yyyy',  // Indian formats
        'MM/dd/yyyy', 'MM-dd-yyyy', 'MM.dd.yyyy',  // US formats
        'yyyy/MM/dd', 'yyyy-MM-dd', 'yyyy.MM.dd',  // ISO formats
        'd/M/yyyy', 'd-M-yyyy', 'd.M.yyyy',        // Single digit day/month
        'M/d/yyyy', 'M-d-yyyy', 'M.d.yyyy'         // US single digit
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

      throw new Error(`Unrecognized date format: ${dateInput}`);
    };

    for (const record of jsonData) {
      try {
        const newAMC = new AMCContract({
          salesdoc: record.salesdoc,
          startdate: parseUniversalDate(record.startdate),
          enddate: parseUniversalDate(record.enddate),
          satypeZDRC_ZDRN: record.satypeZDRC_ZDRN,
          serialnumber: record.serialnumber,
          materialcode: record.materialcode,
          status: record.status
        });

        await newAMC.save();
        insertionResults.push({
          serialnumber: record.serialnumber,
          status: "Created"
        });
      } catch (error) {
        insertionResults.push({
          serialnumber: record.serialnumber,
          status: "Failed",
          error: error.message
        });
      }
      processed++;
    }

    return res.status(200).json({
      deletion: {
        totalExisting,
        deleted: deletedCount,
        progress: deletionProgress
      },
      insertion: {
        total: totalRecords,
        processed: processed,
        results: insertionResults
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
