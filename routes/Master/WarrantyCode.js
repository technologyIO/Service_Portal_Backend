const express = require('express');
const router = express.Router();
const WarrantyCode = require('../../Model/MasterSchema/WarrantyCodeSchema');
const mongoose = require('mongoose');

// Middleware to get a warranty code by ID
async function getWarrantyCodeById(req, res, next) {
    let warrantyCode;
    try {
        warrantyCode = await WarrantyCode.findById(req.params.id);
        if (!warrantyCode) {
            return res.status(404).json({ message: 'Warranty code not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.warrantyCode = warrantyCode;
    next();
}

// Middleware to check for duplicate warranty code
async function checkDuplicateWarrantyCode(req, res, next) {
    let warrantyCode;
    try {
        warrantyCode = await WarrantyCode.findOne({
            warrantycodeid: req.body.warrantycodeid
        });
        if (warrantyCode && warrantyCode._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate warranty code found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}

// BULK DELETE Warranty Code entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/warrantycode/bulk', async (req, res) => {
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

        // Delete multiple warranty codes
        const deleteResult = await WarrantyCode.deleteMany({
            _id: { $in: validIds }
        });

        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({
                message: 'No warranty codes found to delete',
                deletedCount: 0
            });
        }

        res.json({
            message: `Successfully deleted ${deleteResult.deletedCount} warranty codes`,
            deletedCount: deleteResult.deletedCount,
            requestedCount: validIds.length
        });

    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/warrantycode', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const warrantyCodes = await WarrantyCode.find().skip(skip).limit(limit);
        const totalWarrantyCodes = await WarrantyCode.countDocuments();
        const totalPages = Math.ceil(totalWarrantyCodes / limit);

        res.json({
            warrantyCodes,
            totalPages,
            totalWarrantyCodes
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// GET warranty code by ID
router.get('/warrantycode/:id', getWarrantyCodeById, (req, res) => {
    res.json(res.warrantyCode);
});

// CREATE a new warranty code
router.post('/warrantycode', checkDuplicateWarrantyCode, async (req, res) => {
    const warrantyCode = new WarrantyCode({
        warrantycodeid: req.body.warrantycodeid,
        description: req.body.description,
        months: req.body.months,
        status: req.body.status
    });
    try {
        const newWarrantyCode = await warrantyCode.save();
        res.status(201).json(newWarrantyCode);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/searchwarrantycode', async (req, res) => {
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
                { warrantycodeid: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } }
            ]
        };

        // If q is a number, also search by months
        if (!isNaN(q)) {
            query.$or.push({ months: Number(q) });
        }

        const warrantyCodes = await WarrantyCode.find(query).skip(skip).limit(limit);
        const totalWarrantyCodes = await WarrantyCode.countDocuments(query);
        const totalPages = Math.ceil(totalWarrantyCodes / limit);

        res.json({
            warrantyCodes,
            totalPages,
            totalWarrantyCodes,
            currentPage: page,
            isSearch: true
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// UPDATE a warranty code
router.put('/warrantycode/:id', getWarrantyCodeById, checkDuplicateWarrantyCode, async (req, res) => {
    if (req.body.warrantycodeid != null) {
        res.warrantyCode.warrantycodeid = req.body.warrantycodeid;
    }
    if (req.body.description != null) {
        res.warrantyCode.description = req.body.description;
    }
    if (req.body.months != null) {
        res.warrantyCode.months = req.body.months;
    }
    if (req.body.status != null) {
        res.warrantyCode.status = req.body.status;
    }
    try {
        const updatedWarrantyCode = await res.warrantyCode.save();
        res.json(updatedWarrantyCode);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a warranty code
router.delete('/warrantycode/:id', getWarrantyCodeById, async (req, res) => {
    try {
        const deletedWarranty = await WarrantyCode.deleteOne({ _id: req.params.id })
        if (deletedWarranty.deletedCount === 0) {
            res.status(404).json({ message: 'WarrantyCode Not Found' })
        }
        res.json({ message: 'Deleted warranty code' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
