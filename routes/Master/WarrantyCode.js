const express = require('express');
const router = express.Router();
const WarrantyCode = require('../../Model/MasterSchema/WarrantyCodeSchema');

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
       const deletedWarranty = await WarrantyCode.deleteOne({_id:req.params.id})
       if(deletedWarranty.deletedCount===0){
        res.status(404).json({message:'WarrantyCode Not Found'})
       }
        res.json({ message: 'Deleted warranty code' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
