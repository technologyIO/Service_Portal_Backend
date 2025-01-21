const express = require('express');
const router = express.Router();
const PM = require('../../Model/UploadSchema/PMSchema'); // Adjust path based on your folder structure

// Middleware to get a PM by ID
async function getPMById(req, res, next) {
    let pm;
    try {
        pm = await PM.findById(req.params.id);
        if (!pm) {
            return res.status(404).json({ message: 'PM record not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.pm = pm;
    next();
}

// Middleware to check for duplicate pmNumber
async function checkDuplicatePMNumber(req, res, next) {
    let pm;
    try {
        pm = await PM.findOne({ pmNumber: req.body.pmNumber });
        if (pm && pm._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate PM number found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}

// GET all PM records with pagination
router.get('/pms', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const pms = await PM.find().skip(skip).limit(limit);
        const totalPms = await PM.countDocuments();
        const totalPages = Math.ceil(totalPms / limit);

        res.json({
            pms,
            totalPages,
            totalPms
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET PM record by ID
router.get('/pms/:id', getPMById, (req, res) => {
    res.json(res.pm);
});

// CREATE a new PM record
router.post('/pms', checkDuplicatePMNumber, async (req, res) => {
    const pm = new PM({
        pmType: req.body.pmType,
        pmNumber: req.body.pmNumber,
        materialDescription: req.body.materialDescription,
        serialNumber: req.body.serialNumber,
        customerCode: req.body.customerCode,
        regionBranch: req.body.regionBranch,
        pmDueMonth: req.body.pmDueMonth,
        pmDoneDate: req.body.pmDoneDate,
        pmVendorCode: req.body.pmVendorCode,
        pmEngineerCode: req.body.pmEngineerCode,
        pmStatus: req.body.pmStatus
    });
    try {
        const newPM = await pm.save();
        res.status(201).json(newPM);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a PM record
router.put('/pms/:id', getPMById, checkDuplicatePMNumber, async (req, res) => {
    const updates = [
        'pmType',
        'pmNumber',
        'materialDescription',
        'serialNumber',
        'customerCode',
        'regionBranch',
        'pmDueMonth',
        'pmDoneDate',
        'pmVendorCode',
        'pmEngineerCode',
        'pmStatus'
    ];

    updates.forEach(field => {
        if (req.body[field] != null) {
            res.pm[field] = req.body[field];
        }
    });

    try {
        const updatedPM = await res.pm.save();
        res.json(updatedPM);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a PM record
router.delete('/pms/:id', getPMById, async (req, res) => {
    try {
        const deletedPM = await PM.deleteOne({ _id: req.params.id });
        if (deletedPM.deletedCount === 0) {
            return res.status(404).json({ message: 'PM record not found' });
        }
        res.json({ message: 'Deleted PM record' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// SEARCH PM records
router.get('/pmsearch', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const query = {
            $or: [
                { pmType: { $regex: q, $options: 'i' } },
                { pmNumber: { $regex: q, $options: 'i' } },
                { materialDescription: { $regex: q, $options: 'i' } },
                { serialNumber: { $regex: q, $options: 'i' } },
                { customerCode: { $regex: q, $options: 'i' } },
                { regionBranch: { $regex: q, $options: 'i' } },
                { pmVendorCode: { $regex: q, $options: 'i' } },
                { pmEngineerCode: { $regex: q, $options: 'i' } },
                { pmStatus: { $regex: q, $options: 'i' } }
            ]
        };

        const pms = await PM.find(query);
        res.json(pms);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
