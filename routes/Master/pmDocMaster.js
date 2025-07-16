const express = require('express');
const router = express.Router();
const PMDocMaster = require('../../Model/MasterSchema/pmDocMasterSchema');

// 🔹 CREATE
router.post('/', async (req, res) => {
  try {
    const newDoc = new PMDocMaster(req.body);
    await newDoc.save();
    res.status(201).json({ success: true, data: newDoc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 🔹 READ ALL (with pagination)
router.get('/all', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await PMDocMaster.countDocuments();
    const docs = await PMDocMaster.find().skip(skip).limit(limit).sort({ createdAt: -1 });

    res.json({
      success: true,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total,
      data: docs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// 🔍 SEARCH Endpoint (like your dealer example)
router.get('/search-pmdocmaster', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Query parameter "q" is required and must be a string' });
    }

    const query = {
      $or: [
        { productGroup: { $regex: q, $options: 'i' } },
        { chlNo: { $regex: q, $options: 'i' } },
        { revNo: { $regex: q, $options: 'i' } },
        { type: { $regex: q, $options: 'i' } },
        { status: { $regex: q, $options: 'i' } },
      ],
    };

    const results = await PMDocMaster.find(query).sort({ createdAt: -1 });
    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// 🔹 READ ONE BY ID
router.get('/:id', async (req, res) => {
  try {
    const doc = await PMDocMaster.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 🔹 UPDATE BY ID
router.put('/:id', async (req, res) => {
  try {
    req.body.modifiedAt = new Date(); // Update timestamp
    const updated = await PMDocMaster.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 🔹 DELETE BY ID
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await PMDocMaster.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



module.exports = router;
