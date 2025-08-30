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
router.get('/all', async (req, res) => {
    try {


        const records = await CmcNcmcPrice.find();


        res.json({ records});
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// Add this search route to your existing CMC/NCMC price routes
router.get('/searchprices', async (req, res) => {
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
                { partNumber: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { product: { $regex: q, $options: 'i' } },
                { cmcPriceWithGst: isNaN(q) ? undefined : parseFloat(q) },
                { ncmcPriceWithGst: isNaN(q) ? undefined : parseFloat(q) },
                { serviceTax: { $regex: q, $options: 'i' } },
                { remarks: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } }
            ].filter(condition => condition !== undefined)
        };

        const cmcNcmcPrices = await CmcNcmcPrice.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCmcNcmcPrices = await CmcNcmcPrice.countDocuments(query);
        const totalPages = Math.ceil(totalCmcNcmcPrices / limit);

        res.json({
            records: cmcNcmcPrices,
            totalPages,
            totalCmcNcmcPrices,
            currentPage: page,
            isSearch: true
        });
    } catch (err) {
        res.status(500).json({
            message: err.message,
            records: [],
            totalPages: 1,
            totalCmcNcmcPrices: 0,
            currentPage: 1
        });
    }
});

// GET by ID
router.get('/:id', getPriceById, (req, res) => {
    res.json(res.priceRecord);
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

// SEARCH records with pagination
router.get('/search', async (req, res) => {
    try {
        const { q, page = 1, limit = 10 } = req.query;
        if (!q || q.trim() === '') {
            return res.status(400).json({ message: 'Search query (q) is required' });
        }

        const skip = (page - 1) * limit;
        const searchQuery = {
            $or: [
                { partNumber: { $regex: q.trim(), $options: 'i' } },
                { description: { $regex: q.trim(), $options: 'i' } },
                { product: { $regex: q.trim(), $options: 'i' } }
            ]
        };

        const [records, total] = await Promise.all([
            CmcNcmcPrice.find(searchQuery)
                .skip(skip)
                .limit(parseInt(limit)),
            CmcNcmcPrice.countDocuments(searchQuery)
        ]);

        res.json({
            success: true,
            data: records,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Search failed',
            error: err.message
        });
    }
});

module.exports = router;
