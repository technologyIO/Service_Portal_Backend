const express = require('express');
const router = express.Router();
const AMCContract = require('../../Model/UploadSchema/AMCContractSchema');
const mongoose = require('mongoose');

// Middleware to get an AMCContract by ID
async function getAMCContractById(req, res, next) {
    let amcContract;
    try {
        amcContract = await AMCContract.findById(req.params.id);
        if (!amcContract) {
            return res.status(404).json({ message: 'AMC Contract not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.amcContract = amcContract;
    next();
}

// Middleware to check for duplicate salesdoc
async function checkDuplicateSalesDoc(req, res, next) {
    let amcContract;
    try {
        amcContract = await AMCContract.findOne({
            salesdoc: req.body.salesdoc
        });
        if (amcContract && amcContract._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate salesdoc found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}
router.get('/amccontracts/filter-options', async (req, res) => {
    try {
        const amcContracts = await AMCContract.find({}, {
            salesdoc: 1,
            satypeZDRC_ZDRN: 1,
            serialnumber: 1,
            materialcode: 1
        });

        const salesDocs = [...new Set(amcContracts.map(amc => amc.salesdoc).filter(Boolean))];
        const saTypes = [...new Set(amcContracts.map(amc => amc.satypeZDRC_ZDRN).filter(Boolean))];
        const serialNumbers = [...new Set(amcContracts.map(amc => amc.serialnumber).filter(Boolean))];
        const materialCodes = [...new Set(amcContracts.map(amc => amc.materialcode).filter(Boolean))];

        res.json({
            salesDocs: salesDocs.sort(),
            saTypes: saTypes.sort(),
            serialNumbers: serialNumbers.sort(),
            materialCodes: materialCodes.sort()
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET AMC contracts with filters - FIXED STATUS FILTERING
router.get('/amccontracts/filter', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filters = {};

        // Sales Doc filter
        if (req.query.salesdoc) {
            filters.salesdoc = req.query.salesdoc;
        }

        // SA Type filter
        if (req.query.satypeZDRC_ZDRN) {
            filters.satypeZDRC_ZDRN = req.query.satypeZDRC_ZDRN;
        }

        // Serial Number filter
        if (req.query.serialnumber) {
            filters.serialnumber = req.query.serialnumber;
        }

        // Material Code filter
        if (req.query.materialcode) {
            filters.materialcode = req.query.materialcode;
        }

        // ✅ FIXED: Status filter with case-insensitive matching
        if (req.query.status) {
            filters.status = new RegExp(`^${req.query.status}$`, 'i');
        }

        // Start date range filter
        if (req.query.startDateFrom || req.query.startDateTo) {
            filters.startdate = {};
            if (req.query.startDateFrom) {
                filters.startdate.$gte = new Date(req.query.startDateFrom);
            }
            if (req.query.startDateTo) {
                const endDate = new Date(req.query.startDateTo);
                endDate.setHours(23, 59, 59, 999);
                filters.startdate.$lte = endDate;
            }
        }

        // End date range filter
        if (req.query.endDateFrom || req.query.endDateTo) {
            filters.enddate = {};
            if (req.query.endDateFrom) {
                filters.enddate.$gte = new Date(req.query.endDateFrom);
            }
            if (req.query.endDateTo) {
                const endDate = new Date(req.query.endDateTo);
                endDate.setHours(23, 59, 59, 999);
                filters.enddate.$lte = endDate;
            }
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

        console.log('Applied Filters:', filters); // Debug log

        const totalAMCContracts = await AMCContract.countDocuments(filters);
        const amcContracts = await AMCContract.find(filters)
            .skip(skip)
            .limit(limit)
            .sort({ startdate: -1 });

        const totalPages = Math.ceil(totalAMCContracts / limit);

        res.json({
            amcContracts,
            totalAMCContracts,
            totalPages,
            currentPage: page,
            filters: req.query
        });
    } catch (err) {
        console.error('Filter error:', err);
        res.status(500).json({ message: err.message });
    }
});
// BULK DELETE AMC Contract entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/amccontracts/bulk', async (req, res) => {
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

        // Delete multiple AMC contracts
        const deleteResult = await AMCContract.deleteMany({
            _id: { $in: validIds }
        });

        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({
                message: 'No AMC contracts found to delete',
                deletedCount: 0
            });
        }

        res.json({
            message: `Successfully deleted ${deleteResult.deletedCount} AMC contracts`,
            deletedCount: deleteResult.deletedCount,
            requestedCount: validIds.length
        });

    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/amccontracts', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const amcContracts = await AMCContract.find().skip(skip).limit(limit);
        const totalAMCContracts = await AMCContract.countDocuments();
        const totalPages = Math.ceil(totalAMCContracts / limit);

        res.json({
            amcContracts,
            totalPages,
            totalAMCContracts
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// GET AMC Contract by ID
router.get('/amccontracts/:id', getAMCContractById, (req, res) => {
    res.json(res.amcContract);
});

// CREATE a new AMC Contract
router.post('/amccontracts', checkDuplicateSalesDoc, async (req, res) => {
    const amcContract = new AMCContract({
        salesdoc: req.body.salesdoc,
        startdate: req.body.startdate,
        enddate: req.body.enddate,
        satypeZDRC_ZDRN: req.body.satypeZDRC_ZDRN,
        serialnumber: req.body.serialnumber,
        materialcode: req.body.materialcode,
        status: req.body.status
    });
    try {
        const newAMCContract = await amcContract.save();
        res.status(201).json(newAMCContract);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE an AMC Contract
router.put('/amccontracts/:id', getAMCContractById, checkDuplicateSalesDoc, async (req, res) => {
    if (req.body.salesdoc != null) {
        res.amcContract.salesdoc = req.body.salesdoc;
    }
    if (req.body.startdate != null) {
        res.amcContract.startdate = req.body.startdate;
    }
    if (req.body.enddate != null) {
        res.amcContract.enddate = req.body.enddate;
    }
    if (req.body.satypeZDRC_ZDRN != null) {
        res.amcContract.satypeZDRC_ZDRN = req.body.satypeZDRC_ZDRN;
    }
    if (req.body.serialnumber != null) {
        res.amcContract.serialnumber = req.body.serialnumber;
    }
    if (req.body.materialcode != null) {
        res.amcContract.materialcode = req.body.materialcode;
    }
    if (req.body.status != null) {
        res.amcContract.status = req.body.status;
    }
    try {
        const updatedAMCContract = await res.amcContract.save();
        res.json(updatedAMCContract);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE an AMC Contract
router.delete('/amccontracts/:id', getAMCContractById, async (req, res) => {
    try {
        const deletedAMCContract = await AMCContract.deleteOne({ _id: req.params.id });
        if (deletedAMCContract.deletedCount === 0) {
            return res.status(404).json({ message: 'AMC Contract Not Found' });
        }
        res.json({ message: 'Deleted AMC Contract' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/amcsearch', async (req, res) => {
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
                { salesdoc: { $regex: q, $options: 'i' } },
                { satypeZDRC_ZDRN: { $regex: q, $options: 'i' } },
                { serialnumber: { $regex: q, $options: 'i' } },
                { materialcode: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } }
            ]
        };

        const amcContracts = await AMCContract.find(query).skip(skip).limit(limit);
        const totalAMCContracts = await AMCContract.countDocuments(query);
        const totalPages = Math.ceil(totalAMCContracts / limit);

        res.json({
            amcContracts,
            totalPages,
            totalAMCContracts,
            currentPage: page,
            isSearch: true
        });

    } catch (err) {
        res.status(500).json({
            message: err.message,
            amcContracts: [],
            totalPages: 1,
            totalAMCContracts: 0,
            currentPage: 1
        });
    }
});


module.exports = router;
