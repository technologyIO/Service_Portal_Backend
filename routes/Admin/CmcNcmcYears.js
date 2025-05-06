const express = require('express');
const router = express.Router();
const CmcNcmcYear = require('../../Model/AdminSchema/CmcNcmcYearsSchema');

// Middleware to get CMC/NCMC year by ID
async function getCmcNcmcYearById(req, res, next) {
    try {
        const cmcYear = await CmcNcmcYear.findById(req.params.id);
        if (!cmcYear) return res.status(404).json({ message: 'Year entry not found' });
        res.cmcYear = cmcYear;
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// Middleware to check for duplicate year
async function checkDuplicateYear(req, res, next) {
    try {
        const existing = await CmcNcmcYear.findOne({ year: req.body.year });
        if (existing && (!req.params.id || existing._id.toString() !== req.params.id)) {
            return res.status(400).json({ message: 'Year already exists' });
        }
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// GET all with pagination
router.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    try {
        const total = await CmcNcmcYear.countDocuments();
        const years = await CmcNcmcYear.find()
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ year: -1 });

        res.json({
            data: years,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET by ID
router.get('/:id', getCmcNcmcYearById, (req, res) => {
    res.json(res.cmcYear);
});

// SEARCH by year or status
router.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'Query is required' });

    try {
        const result = await CmcNcmcYear.find({
            $or: [
                { year: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } }
            ]
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// CREATE
router.post('/', checkDuplicateYear, async (req, res) => {
    const newYear = new CmcNcmcYear({
        year: req.body.year,
        status: req.body.status
    });

    try {
        const saved = await newYear.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE
router.put('/:id', getCmcNcmcYearById, checkDuplicateYear, async (req, res) => {
    if (req.body.year !== undefined) res.cmcYear.year = req.body.year;
    if (req.body.status !== undefined) res.cmcYear.status = req.body.status;
    res.cmcYear.modifiedAt = new Date();

    try {
        const updated = await res.cmcYear.save();
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE
router.delete('/:id', getCmcNcmcYearById, async (req, res) => {
    try {
        await res.cmcYear.deleteOne();
        res.json({ message: 'Year entry deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
