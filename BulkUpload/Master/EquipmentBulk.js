const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const Equipment = require('../../Model/MasterSchema/EquipmentSchema'); // aapka mongoose model

// Multer memory storage use kar rahe hain taki file ko directly memory se process kar saken
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// POST /api/equipment/bulk-upload
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

    // Har record ko process karte hue database mein save karte hain
    for (const record of jsonData) {
      try {
        // Pehle check karein agar record with same serialnumber exist karta hai
        const existingEquipment = await Equipment.findOne({ serialnumber: record.serialnumber });
        let statusMessage = 'Created';
        if (existingEquipment) {
          // Agar exist karta hai to usko delete kar dein
          await Equipment.deleteOne({ _id: existingEquipment._id });
          statusMessage = 'Updated'; // Indicating that old record was replaced with updated data.
        }

        const newEquipment = new Equipment({
          name: record.name,
          materialdescription: record.materialdescription,
          serialnumber: record.serialnumber,
          materialcode: record.materialcode,
          status: record.status,
          currentcustomer: record.currentcustomer,
          endcustomer: record.endcustomer, // Agar date conversion chahiye to yahan conversion karein
          custWarrantystartdate: record.custWarrantystartdate,
          custWarrantyenddate: record.custWarrantyenddate,
          dealerwarrantystartdate: record.dealerwarrantystartdate,
          dealerwarrantyenddate: record.dealerwarrantyenddate,
          dealer: record.dealer,
          palnumber: record.palnumber,
          installationreportno: record.installationreportno
        });

        await newEquipment.save();
        results.push({ serialnumber: record.serialnumber, status: statusMessage });
      } catch (error) {
        results.push({
          serialnumber: record.serialnumber,
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
