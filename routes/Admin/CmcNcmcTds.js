const express = require('express');
const router = express.Router();
const CmcNcmcTds = require('../../Model/AdminSchema/CmcNcmcTdsSchema');

// Middleware: Get TDS by ID
async function getTdsById(req, res, next) {
    try {
        const record = await CmcNcmcTds.findById(req.params.id);
        if (!record) return res.status(404).json({ message: 'TDS record not found' });
        res.tdsRecord = record;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

// Middleware: Check for duplicate TDS
async function checkDuplicateTds(req, res, next) {
    try {
        const existing = await CmcNcmcTds.findOne({ tds: req.body.tds });
        if (existing && (!req.params.id || existing._id.toString() !== req.params.id)) {
            return res.status(400).json({ message: 'Duplicate TDS value found' });
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

        const records = await CmcNcmcTds.find().skip(skip).limit(limit);
        const total = await CmcNcmcTds.countDocuments();
        const totalPages = Math.ceil(total / limit);

        res.json({ records, totalPages, total });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// Add this search route to your existing CMC/NCMC TDS routes
router.get('/searchtds', async (req, res) => {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        if (!q) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const query = {
            $or: [
                { tds: { $regex: q, $options: 'i' } },
                { role: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } }
            ]
        };

        const cmcNcmcTds = await CmcNcmcTds.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCmcNcmcTds = await CmcNcmcTds.countDocuments(query);
        const totalPages = Math.ceil(totalCmcNcmcTds / limit);

        res.json({
            records: cmcNcmcTds,
            totalPages,
            totalCmcNcmcTds,
            currentPage: page,
            isSearch: true
        });
    } catch (err) {
        res.status(500).json({
            message: err.message,
            records: [],
            totalPages: 1,
            totalCmcNcmcTds: 0,
            currentPage: 1
        });
    }
});

// GET by ID
router.get('/:id', getTdsById, (req, res) => {
    res.json(res.tdsRecord);
});

// CREATE
router.post('/', checkDuplicateTds, async (req, res) => {
    const tds = new CmcNcmcTds({
        tds: req.body.tds,
        role: req.body.role,
        status: req.body.status
    });

    try {
        const saved = await tds.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE
router.put('/:id', getTdsById, checkDuplicateTds, async (req, res) => {
    const fields = ['tds', 'role', 'status'];
    fields.forEach(field => {
        if (req.body[field] != null) res.tdsRecord[field] = req.body[field];
    });
    res.tdsRecord.modifiedAt = Date.now();

    try {
        const updated = await res.tdsRecord.save();
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE
router.delete('/:id', getTdsById, async (req, res) => {
    try {
        await res.tdsRecord.deleteOne();
        res.json({ message: 'Deleted TDS record' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
