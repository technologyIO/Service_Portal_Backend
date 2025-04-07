const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const CheckList = require('../../Model/CollectionSchema/ChecklistSchema'); // aapka mongoose model

// Multer memory storage ka istemal
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// POST /bulk-upload
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Excel file ko parse karna
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    const totalRecords = jsonData.length;
    let processed = 0;
    const results = [];

    // Har record ko process karte hue, duplicate check ke liye checklisttype, checkpoint aur prodGroup compare karte hain
    for (const record of jsonData) {
      try {
        // Duplicate record check: agar same checklisttype, checkpoint aur prodGroup ka record pehle se exist karta hai
        const duplicate = await CheckList.findOne({
          checklisttype: record.checklisttype,
          checkpoint: record.checkpoint,
          prodGroup: record.prodGroup
        });

        if (duplicate) {
          // Agar duplicate mil jaye, to record ko skip karein
          results.push({
            checklisttype: record.checklisttype,
            checkpoint: record.checkpoint,
            prodGroup: record.prodGroup,
            status: 'Skipped',
            error: 'Duplicate checklist found. Only first occurrence is uploaded.'
          });
        } else {
          // Naya checklist document banayein aur save karein
          const newChecklist = new CheckList({
            checklisttype: record.checklisttype,
            status: record.status,
            checkpointtype: record.checkpointtype, // agar file mein ho to
            checkpoint: record.checkpoint,
            prodGroup: record.prodGroup,
            result: record.result,
            resulttype: record.resulttype
          });

          await newChecklist.save();
          results.push({
            checklisttype: record.checklisttype,
            checkpoint: record.checkpoint,
            prodGroup: record.prodGroup,
            status: 'Created'
          });
        }
      } catch (err) {
        results.push({
          checklisttype: record.checklisttype,
          checkpoint: record.checkpoint,
          prodGroup: record.prodGroup,
          status: 'Failed',
          error: err.message
        });
      }
      processed++;
    }

    return res.status(200).json({
      total: totalRecords,
      processed: processed,
      results: results
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
