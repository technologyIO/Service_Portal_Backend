const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const Product = require('../../Model/MasterSchema/ProductSchema'); // aapka mongoose model

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
    // Set to track part numbers already processed in the file
    const seenPartNos = new Set();

    // Har record ko process karte hue DB mein save karte hain
    for (const record of jsonData) {
      // Agar file ke andar duplicate part number hai to skip karein
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
        // DB mein check karein ki same partnoid ka record exist karta hai ya nahi
        const existingProduct = await Product.findOne({ partnoid: record.partnoid });
        let statusMessage = 'Created';
        if (existingProduct) {
          // Agar exist karta hai, to usko delete kar dein (replace operation)
          await Product.deleteOne({ _id: existingProduct._id });
          statusMessage = 'Updated';
        }

        // Naya Product document banayein
        const newProduct = new Product({
          productgroup: record.productgroup,
          partnoid: record.partnoid,
          product: record.product,
          subgrp: record.subgrp,
          frequency: record.frequency,
          dateoflaunch: record.dateoflaunch, // Date conversion agar required ho
          endofsaledate: record.endofsaledate,
          endofsupportdate: record.endofsupportdate,
          exsupportavlb: record.exsupportavlb, // File mein yeh value true/false honi chahiye
          installationcheckliststatusboolean: record.installationcheckliststatusboolean,
          pmcheckliststatusboolean: record.pmcheckliststatusboolean
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
