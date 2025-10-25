const express = require('express');
const router = express.Router();
const Dealer = require('../../Model/MasterSchema/DealerSchema');
const mongoose = require('mongoose');

// Middleware to get dealer by ID
async function getDealerById(req, res, next) {
    try {
        const dealer = await Dealer.findById(req.params.id);
        if (!dealer) {
            return res.status(404).json({ message: 'Dealer not found' });
        }
        res.dealer = dealer;
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// Middleware to check for duplicate email or dealercode
async function checkDuplicateFields(req, res, next) {
    try {
        const existingEmail = await Dealer.findOne({ email: req.body.email });
        const existingCode = await Dealer.findOne({ dealercode: req.body.dealercode });

        if (existingEmail && existingEmail._id != req.params.id) {
            return res.status(400).json({ message: 'Email already exists' });
        }
        if (existingCode && existingCode._id != req.params.id) {
            return res.status(400).json({ message: 'Dealer code already exists' });
        }
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// GET paginated dealers
router.get('/dealer', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const dealers = await Dealer.find().skip(skip).limit(limit);
        const totalDealers = await Dealer.countDocuments();
        const totalPages = Math.ceil(totalDealers / limit);

        res.json({ dealers, totalDealers, totalPages });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET all dealers (no pagination)
router.get('/alldealer', async (req, res) => {
    try {
        const dealers = await Dealer.find();
        res.json({ dealers });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// BULK DELETE Dealer entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/dealer/bulk', async (req, res) => {
    try {
        const { ids } = req.body;

        // Validate input
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Please provide valid IDs array' });
        }

        // Validate ObjectIds
        const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIds.length === 0) {
            return res.status(400).json({ message: 'No valid IDs provided' });
        }

        // Delete multiple dealers
        const deleteResult = await Dealer.deleteMany({
            _id: { $in: validIds }
        });

        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({
                message: 'No dealers found to delete',
                deletedCount: 0
            });
        }

        res.json({
            message: `Successfully deleted ${deleteResult.deletedCount} dealers`,
            deletedCount: deleteResult.deletedCount,
            requestedCount: validIds.length
        });

    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET dealer by ID
router.get('/dealer/:id', getDealerById, (req, res) => {
    res.json(res.dealer);
});

// CREATE a new dealer
router.post('/dealer', checkDuplicateFields, async (req, res) => {
    const dealer = new Dealer({
        name: req.body.name,
        personresponsible: req.body.personresponsible || [],
        email: req.body.email,
        status: req.body.status, // will default to 'active' if not passed
        dealercode: req.body.dealercode,
        state: req.body.state,
        address: req.body.address,
        city: req.body.city,
        pincode: req.body.pincode,
    });

    try {
        const newDealer = await dealer.save();
        res.status(201).json(newDealer);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a dealer
router.put('/dealer/:id', getDealerById, checkDuplicateFields, async (req, res) => {
    const fields = ['name', 'personresponsible', 'email', 'status', 'dealercode', 'state', 'address', 'city', 'pincode'];

    fields.forEach(field => {
        if (req.body[field] != null) {
            res.dealer[field] = req.body[field];
        }
    });

    res.dealer.modifiedAt = new Date();

    try {
        const updatedDealer = await res.dealer.save();
        res.json(updatedDealer);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a dealer
router.delete('/dealer/:id', async (req, res) => {
    try {
        const deleted = await Dealer.deleteOne({ _id: req.params.id });
        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'Dealer not found' });
        }
        res.json({ message: 'Deleted dealer' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// SEARCH dealers





module.exports = router;
