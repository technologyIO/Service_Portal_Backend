const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const Product = require('../../Model/MasterSchema/ProductSchema');

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Excel serial date converter
function convertExcelDate(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'number') {
    return new Date((excelDate - 25569) * 86400 * 1000); // Excel to JS Date
  }
  return new Date(excelDate); // Already date string
}

// POST /bulk-upload
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    const totalRecords = jsonData.length;
    let processed = 0;
    const results = [];
    const seenPartNos = new Set();

    for (const record of jsonData) {
      if (seenPartNos.has(record.partnoid)) {
        results.push({
          partnoid: record.partnoid,
          status: 'Skipped',
          error: 'Duplicate part number in file. Only first occurrence is uploaded.'
        });
        processed++;
        continue;
      }
      seenPartNos.add(record.partnoid);

      try {
        const existingProduct = await Product.findOne({ partnoid: record.partnoid });
        let statusMessage = 'Created';

        if (existingProduct) {
          await Product.deleteOne({ _id: existingProduct._id });
          statusMessage = 'Updated';
        }

        const newProduct = new Product({
          productgroup: record.productgroup,
          partnoid: record.partnoid,
          product: record.product,
          subgrp: record.subgrp,
          frequency: record.frequency,
          dateoflaunch: convertExcelDate(record.dateoflaunch),
          endofsaledate: convertExcelDate(record.endofsaledate),
          endofsupportdate: convertExcelDate(record.endofsupportdate),
          exsupportavlb: convertExcelDate(record.exsupportavlb),
          installationcheckliststatusboolean: String(record.installationcheckliststatusboolean),
          pmcheckliststatusboolean: String(record.pmcheckliststatusboolean),
        });

        await newProduct.save();
        results.push({ partnoid: record.partnoid, status: statusMessage });

      } catch (error) {
        results.push({
          partnoid: record.partnoid,
          status: 'Failed',
          error: error.message
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
