const express = require('express');
const router = express.Router();
const ServiceCharge = require('../../Model/AdminSchema/ServiceChargeSchema');

// Create
router.post('/', async (req, res) => {
    try {
        const serviceCharge = new ServiceCharge(req.body);
        await serviceCharge.save();
        res.status(201).json(serviceCharge);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Read All
router.get('/', async (req, res) => {
    try {
        const serviceCharges = await ServiceCharge.find();
        res.json(serviceCharges);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/allservicecharge', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const serviceCharges = await ServiceCharge.find().skip(skip).limit(limit);
        const totalServiceCharge = await ServiceCharge.countDocuments();
        const totalPages = Math.ceil(totalServiceCharge / limit);

        res.json({
            serviceCharges,
            totalPages,
            totalServiceCharge
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/:partNumber', async (req, res) => {
    try {
        // Case-insensitive match for partNumber
        const partNumber = req.params.partNumber;
        const record = await ServiceCharge.findOne({ partNumber: partNumber });

        if (!record) {
            return res.status(404).json({ success: false, message: 'No record found for this part number' });
        }
        res.json({ success: true, serviceCharge: record });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const serviceCharge = await ServiceCharge.findById(req.params.id);
        if (!serviceCharge) return res.status(404).json({ error: 'Not found' });
        res.json(serviceCharge);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update
router.put('/:id', async (req, res) => {
    try {
        const serviceCharge = await ServiceCharge.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!serviceCharge) return res.status(404).json({ error: 'Not found' });
        res.json(serviceCharge);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete
router.delete('/:id', async (req, res) => {
    try {
        const serviceCharge = await ServiceCharge.findByIdAndDelete(req.params.id);
        if (!serviceCharge) return res.status(404).json({ error: 'Not found' });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// backend/routes/serviceCharge.js
router.get('/search/:key', async (req, res) => {
    try {
        const key = req.params.key;
        const orQuery = [
            { partNumber: { $regex: key, $options: 'i' } },
            { description: { $regex: key, $options: 'i' } },
            { Product: { $regex: key, $options: 'i' } }
        ];

        // If key is a number, add number fields (cmcPrice, ncmcPrice)
        if (!isNaN(Number(key))) {
            const num = Number(key);
            orQuery.push({ cmcPrice: num });
            orQuery.push({ ncmcPrice: num });
        }

        const serviceCharges = await ServiceCharge.find({ $or: orQuery });
        res.json({ serviceCharges });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



module.exports = router;
