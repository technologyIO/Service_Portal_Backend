const express = require('express');
const router = express.Router();
const Discount = require('../../Model/AdminSchema/DiscountSchema');

// Middleware: Get Discount by ID
async function getDiscountById(req, res, next) {
    try {
        const discount = await Discount.findById(req.params.id);
        if (!discount) return res.status(404).json({ message: 'Discount not found' });
        res.discount = discount;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

// Middleware: Check Duplicate Discount Title
async function checkDuplicateTitle(req, res, next) {
    try {
        const existing = await Discount.findOne({ title: req.body.discount });
        if (existing && (!req.params.id || existing._id.toString() !== req.params.id)) {
            return res.status(400).json({ message: 'Duplicate discount found' });
        }
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

// GET all
router.get('/', async (req, res) => {
    try {
        const records = await Discount.find();
        res.json(records);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET by ID
router.get('/:id', getDiscountById, (req, res) => {
    res.json(res.discount);
});

// CREATE
router.post('/', checkDuplicateTitle, async (req, res) => {
    const discount = new Discount({
        discount: req.body.discount,
        status: req.body.status
    });

    try {
        const saved = await discount.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE
router.put('/:id', getDiscountById, checkDuplicateTitle, async (req, res) => {
    const fields = ['discount','status'];
    fields.forEach(field => {
        if (req.body[field] != null) res.discount[field] = req.body[field];
    });
    res.discount.modifiedAt = Date.now();

    try {
        const updated = await res.discount.save();
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE
router.delete('/:id', getDiscountById, async (req, res) => {
    try {
        await res.discount.deleteOne();
        res.json({ message: 'Discount record deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
