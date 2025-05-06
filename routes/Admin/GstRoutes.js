const express = require('express');
const router = express.Router();
const Gst = require('../../Model/AdminSchema/GstSchema');

// Middleware: Get GST by ID
async function getGstById(req, res, next) {
    try {
        const record = await Gst.findById(req.params.id);
        if (!record) return res.status(404).json({ message: 'GST record not found' });
        res.gstRecord = record;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

// Middleware: Check for duplicate GST
async function checkDuplicateGst(req, res, next) {
    try {
        const existing = await Gst.findOne({ gst: req.body.gst });
        if (existing && (!req.params.id || existing._id.toString() !== req.params.id)) {
            return res.status(400).json({ message: 'Duplicate GST value found' });
        }
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

// GET all
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const records = await Gst.find().skip(skip).limit(limit);
        const total = await Gst.countDocuments();
        const totalPages = Math.ceil(total / limit);

        res.json({ records, totalPages, total });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET by ID
router.get('/:id', getGstById, (req, res) => {
    res.json(res.gstRecord);
});

// CREATE
router.post('/', checkDuplicateGst, async (req, res) => {
    const gst = new Gst({
        gst: req.body.gst,
        role: req.body.role,
        status: req.body.status
    });

    try {
        const saved = await gst.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE
router.put('/:id', getGstById, checkDuplicateGst, async (req, res) => {
    const fields = ['gst', 'role', 'status'];
    fields.forEach(field => {
        if (req.body[field] != null) res.gstRecord[field] = req.body[field];
    });
    res.gstRecord.modifiedAt = Date.now();

    try {
        const updated = await res.gstRecord.save();
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE
router.delete('/:id', getGstById, async (req, res) => {
    try {
        await res.gstRecord.deleteOne();
        res.json({ message: 'Deleted GST record' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
