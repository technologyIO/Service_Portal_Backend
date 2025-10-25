const express = require('express');
const router = express.Router();
const ReplacedPartCode = require('../../Model/MasterSchema/ReplacedPartCodeSchema');
const mongoose = require('mongoose');

// Middleware to get a replaced part code by ID
async function getReplacedPartCodeById(req, res, next) {
    let replacedPartCode;
    try {
        replacedPartCode = await ReplacedPartCode.findById(req.params.id);
        if (!replacedPartCode) {
            return res.status(404).json({ message: 'Replaced part code not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.replacedPartCode = replacedPartCode;
    next();
}

// Middleware to check for duplicate replaced part code
async function checkDuplicateReplacedPartCode(req, res, next) {
    let replacedPartCode;
    try {
        replacedPartCode = await ReplacedPartCode.findOne({
            code: req.body.code
        });
        if (replacedPartCode && replacedPartCode._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate replaced part code found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}
router.get('/replacedpartcodes/filter-options', async (req, res) => {
    try {
        const replacedPartCodes = await ReplacedPartCode.find({}, {
            catalog: 1,
            codegroup: 1,
            code: 1
        });

        const catalogs = [...new Set(replacedPartCodes.map(rpc => rpc.catalog).filter(Boolean))];
        const codeGroups = [...new Set(replacedPartCodes.map(rpc => rpc.codegroup).filter(Boolean))];
        const codes = [...new Set(replacedPartCodes.map(rpc => rpc.code).filter(Boolean))];

        res.json({
            catalogs: catalogs.sort(),
            codeGroups: codeGroups.sort(),
            codes: codes.sort()
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET replaced part codes with filters
router.get('/replacedpartcodes/filter', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filters = {};

        // Catalog filter
        if (req.query.catalog) {
            filters.catalog = req.query.catalog;
        }

        // Code Group filter
        if (req.query.codegroup) {
            filters.codegroup = req.query.codegroup;
        }

        // Name filter
        if (req.query.name) {
            filters.name = { $regex: req.query.name, $options: 'i' };
        }

        // Code filter
        if (req.query.code) {
            filters.code = req.query.code;
        }

        // Short Text For Code filter
        if (req.query.shorttextforcode) {
            filters.shorttextforcode = { $regex: req.query.shorttextforcode, $options: 'i' };
        }

        // Serial No filter
        if (req.query.slno) {
            filters.slno = { $regex: req.query.slno, $options: 'i' };
        }

        // Status filter
        if (req.query.status) {
            filters.status = req.query.status;
        }

        // Created date range filter
        if (req.query.createdStartDate || req.query.createdEndDate) {
            filters.createdAt = {};
            if (req.query.createdStartDate) {
                filters.createdAt.$gte = new Date(req.query.createdStartDate);
            }
            if (req.query.createdEndDate) {
                const endDate = new Date(req.query.createdEndDate);
                endDate.setHours(23, 59, 59, 999);
                filters.createdAt.$lte = endDate;
            }
        }

        // Modified date range filter
        if (req.query.modifiedStartDate || req.query.modifiedEndDate) {
            filters.modifiedAt = {};
            if (req.query.modifiedStartDate) {
                filters.modifiedAt.$gte = new Date(req.query.modifiedStartDate);
            }
            if (req.query.modifiedEndDate) {
                const endDate = new Date(req.query.modifiedEndDate);
                endDate.setHours(23, 59, 59, 999);
                filters.modifiedAt.$lte = endDate;
            }
        }

        const totalReplacedPartCodes = await ReplacedPartCode.countDocuments(filters);
        const replacedPartCodes = await ReplacedPartCode.find(filters)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const totalPages = Math.ceil(totalReplacedPartCodes / limit);

        res.json({
            replacedPartCodes,
            totalReplacedPartCodes,
            totalPages,
            currentPage: page,
            filters: req.query
        });
    } catch (err) {
        console.error('Filter error:', err);
        res.status(500).json({ message: err.message });
    }
});
router.get('/replacedpartcodes', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const replacedPartCodes = await ReplacedPartCode.find().skip(skip).limit(limit);
        const totalReplacedPartCodes = await ReplacedPartCode.countDocuments();
        const totalPages = Math.ceil(totalReplacedPartCodes / limit);

        res.json({
            replacedPartCodes,
            totalPages,
            totalReplacedPartCodes
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// BULK DELETE Replaced Part Code entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/replacedpartcodes/bulk', async (req, res) => {
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

        // Delete multiple replaced part codes
        const deleteResult = await ReplacedPartCode.deleteMany({
            _id: { $in: validIds }
        });

        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({
                message: 'No replaced part codes found to delete',
                deletedCount: 0
            });
        }

        res.json({
            message: `Successfully deleted ${deleteResult.deletedCount} replaced part codes`,
            deletedCount: deleteResult.deletedCount,
            requestedCount: validIds.length
        });

    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET replaced part code by ID
router.get('/replacedpartcodes/:id', getReplacedPartCodeById, (req, res) => {
    res.json(res.replacedPartCode);
});

// CREATE a new replaced part code
router.post('/replacedpartcodes', checkDuplicateReplacedPartCode, async (req, res) => {
    const replacedPartCode = new ReplacedPartCode({
        catalog: req.body.catalog,
        codegroup: req.body.codegroup,
        name: req.body.name,
        code: req.body.code,
        shorttextforcode: req.body.shorttextforcode,
        slno: req.body.slno,
        status: req.body.status
    });
    try {
        const newReplacedPartCode = await replacedPartCode.save();
        res.status(201).json(newReplacedPartCode);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/searchreplacedpartcodes', async (req, res) => {
    try {
        const { q, page = 1, limit = 10 } = req.query;

        if (!q) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const query = {
            $or: [
                { catalog: { $regex: q, $options: 'i' } },
                { codegroup: { $regex: q, $options: 'i' } },
                { name: { $regex: q, $options: 'i' } },
                { code: { $regex: q, $options: 'i' } },
                { shorttextforcode: { $regex: q, $options: 'i' } },
                { slno: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } }
            ]
        };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const totalReplacedPartCodes = await ReplacedPartCode.countDocuments(query);
        const totalPages = Math.ceil(totalReplacedPartCodes / limit);

        const replacedPartCodes = await ReplacedPartCode.find(query)
            .skip(skip)
            .limit(parseInt(limit));

        res.json({
            replacedPartCodes,
            totalReplacedPartCodes,
            totalPages,
            currentPage: parseInt(page),
            isSearch: true
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});



// UPDATE a replaced part code
router.put('/replacedpartcodes/:id', getReplacedPartCodeById, checkDuplicateReplacedPartCode, async (req, res) => {
    if (req.body.catalog != null) {
        res.replacedPartCode.catalog = req.body.catalog;
    }
    if (req.body.codegroup != null) {
        res.replacedPartCode.codegroup = req.body.codegroup;
    }
    if (req.body.name != null) {
        res.replacedPartCode.name = req.body.name;
    }
    if (req.body.code != null) {
        res.replacedPartCode.code = req.body.code;
    }
    if (req.body.shorttextforcode != null) {
        res.replacedPartCode.shorttextforcode = req.body.shorttextforcode;
    }
    if (req.body.slno != null) {
        res.replacedPartCode.slno = req.body.slno;
    }
    if (req.body.status != null) {
        res.replacedPartCode.status = req.body.status;
    }
    try {
        const updatedReplacedPartCode = await res.replacedPartCode.save();
        res.json(updatedReplacedPartCode);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a replaced part code
router.delete('/replacedpartcodes/:id', getReplacedPartCodeById, async (req, res) => {
    try {
        const deletedReplacedPartCode = await ReplacedPartCode.deleteOne({ _id: req.params.id });
        if (deletedReplacedPartCode.deletedCount === 0) {
            return res.status(404).json({ message: 'Replaced part code not found' });
        }
        res.json({ message: 'Deleted replaced part code' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
