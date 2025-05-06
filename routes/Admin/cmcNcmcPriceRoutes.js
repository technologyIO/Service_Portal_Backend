const express = require('express');
const router = express.Router();
const CmcNcmcPrice = require('../../Model/AdminSchema/CmcNcmcPriceSchema');

// Middleware to get record by ID
async function getPriceById(req, res, next) {
    try {
        const record = await CmcNcmcPrice.findById(req.params.id);
        if (!record) return res.status(404).json({ message: 'Record not found' });
        res.priceRecord = record;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

// Middleware to check for duplicate partNumber
async function checkDuplicatePartNumber(req, res, next) {
    try {
        const existing = await CmcNcmcPrice.findOne({ partNumber: req.body.partNumber });
        if (existing && (!req.params.id || existing._id.toString() !== req.params.id)) {
            return res.status(400).json({ message: 'Duplicate Part Number found' });
        }
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

// GET all records with pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const records = await CmcNcmcPrice.find().skip(skip).limit(limit);
        const total = await CmcNcmcPrice.countDocuments();
        const totalPages = Math.ceil(total / limit);

        res.json({ records, totalPages, total });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET by ID
router.get('/:id', getPriceById, (req, res) => {
    res.json(res.priceRecord);
});

// SEARCH records
router.get('/search/part', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ message: 'Query is required' });

        const result = await CmcNcmcPrice.find({
            $or: [
                { partNumber: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { product: { $regex: q, $options: 'i' } }
            ]
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// CREATE new record
router.post('/', checkDuplicatePartNumber, async (req, res) => {
    const price = new CmcNcmcPrice({
        partNumber: req.body.partNumber,
        description: req.body.description,
        product: req.body.product,
        cmcPriceWithGst: req.body.cmcPriceWithGst,
        ncmcPriceWithGst: req.body.ncmcPriceWithGst,
        serviceTax: req.body.serviceTax,
        remarks: req.body.remarks,
        status: req.body.status
    });

    try {
        const saved = await price.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE
router.put('/:id', getPriceById, checkDuplicatePartNumber, async (req, res) => {
    const fields = ['partNumber', 'description', 'product', 'cmcPriceWithGst', 'ncmcPriceWithGst', 'serviceTax', 'remarks', 'status'];
    fields.forEach(field => {
        if (req.body[field] != null) res.priceRecord[field] = req.body[field];
    });
    res.priceRecord.modifiedAt = Date.now();

    try {
        const updated = await res.priceRecord.save();
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE
router.delete('/:id', getPriceById, async (req, res) => {
    try {
        await res.priceRecord.deleteOne();
        res.json({ message: 'Deleted record' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
