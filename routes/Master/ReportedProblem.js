const express = require('express');
const router = express.Router();
const ReportedProblem = require('../../Model/MasterSchema/ReportedProblemSchema');
const mongoose = require('mongoose');

// Middleware to get a reported problem by ID
async function getReportedProblemById(req, res, next) {
    let reportedProblem;
    try {
        reportedProblem = await ReportedProblem.findById(req.params.id);
        if (!reportedProblem) {
            return res.status(404).json({ message: 'Reported problem not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.reportedProblem = reportedProblem;
    next();
}

// Middleware to check for duplicate reported problem
async function checkDuplicateReportedProblem(req, res, next) {
    let reportedProblem;
    try {
        reportedProblem = await ReportedProblem.findOne({
            catalog: req.body.catalog,
            codegroup: req.body.codegroup,
            prodgroup: req.body.prodgroup,
            name: req.body.name,
            shorttextforcode: req.body.shorttextforcode,
        });
        if (reportedProblem && reportedProblem._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate reported problem found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}
router.get('/reportedproblem/filter-options', async (req, res) => {
    try {
        const reportedProblems = await ReportedProblem.find({}, {
            catalog: 1,
            codegroup: 1,
            prodgroup: 1
        });

        const catalogs = [...new Set(reportedProblems.map(rp => rp.catalog).filter(Boolean))];
        const codeGroups = [...new Set(reportedProblems.map(rp => rp.codegroup).filter(Boolean))];
        const prodGroups = [...new Set(reportedProblems.map(rp => rp.prodgroup).filter(Boolean))];

        res.json({
            catalogs: catalogs.sort(),
            codeGroups: codeGroups.sort(),
            prodGroups: prodGroups.sort()
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET reported problems with filters
router.get('/reportedproblem/filter', async (req, res) => {
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

        // Product Group filter
        if (req.query.prodgroup) {
            filters.prodgroup = req.query.prodgroup;
        }

        // Name filter
        if (req.query.name) {
            filters.name = { $regex: req.query.name, $options: 'i' };
        }

        // Short Text For Code filter
        if (req.query.shorttextforcode) {
            filters.shorttextforcode = { $regex: req.query.shorttextforcode, $options: 'i' };
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

        const totalReportedProblems = await ReportedProblem.countDocuments(filters);
        const reportedProblems = await ReportedProblem.find(filters)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const totalPages = Math.ceil(totalReportedProblems / limit);

        res.json({
            reportedProblems,
            totalReportedProblems,
            totalPages,
            currentPage: page,
            filters: req.query
        });
    } catch (err) {
        console.error('Filter error:', err);
        res.status(500).json({ message: err.message });
    }
});
// GET all reported problems
router.get('/reportedproblem', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const reportedProblems = await ReportedProblem.find().skip(skip).limit(limit);
        const totalReportedProblems = await ReportedProblem.countDocuments();
        const totalPages = Math.ceil(totalReportedProblems / limit);

        res.json({
            reportedProblems,
            totalPages,
            totalReportedProblems
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// BULK DELETE Reported Problem entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/reportedproblem/bulk', async (req, res) => {
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

        // Delete multiple reported problems
        const deleteResult = await ReportedProblem.deleteMany({
            _id: { $in: validIds }
        });

        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({
                message: 'No reported problems found to delete',
                deletedCount: 0
            });
        }

        res.json({
            message: `Successfully deleted ${deleteResult.deletedCount} reported problems`,
            deletedCount: deleteResult.deletedCount,
            requestedCount: validIds.length
        });

    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET reported problem by ID
router.get('/reportedproblem/:id', getReportedProblemById, (req, res) => {
    res.json(res.reportedProblem);
});

// CREATE a new reported problem
router.post('/reportedproblem', checkDuplicateReportedProblem, async (req, res) => {
    const reportedProblem = new ReportedProblem({
        catalog: req.body.catalog,
        codegroup: req.body.codegroup,
        prodgroup: req.body.prodgroup,
        name: req.body.name,
        shorttextforcode: req.body.shorttextforcode,
        status: req.body.status
    });
    try {
        const newReportedProblem = await reportedProblem.save();
        res.status(201).json(newReportedProblem);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/searchreportedproblem', async (req, res) => {
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
                { catalog: { $regex: q, $options: 'i' } },
                { codegroup: { $regex: q, $options: 'i' } },
                { prodgroup: { $regex: q, $options: 'i' } },
                { name: { $regex: q, $options: 'i' } },
                { shorttextforcode: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } }
            ]
        };

        const reportedProblems = await ReportedProblem.find(query).skip(skip).limit(limit);
        const totalReportedProblems = await ReportedProblem.countDocuments(query);
        const totalPages = Math.ceil(totalReportedProblems / limit);

        res.json({
            reportedProblems,
            totalPages,
            totalReportedProblems,
            currentPage: page,
            isSearch: true
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// UPDATE a reported problem
router.put('/reportedproblem/:id', getReportedProblemById, checkDuplicateReportedProblem, async (req, res) => {
    if (req.body.catalog != null) {
        res.reportedProblem.catalog = req.body.catalog;
    }
    if (req.body.codegroup != null) {
        res.reportedProblem.codegroup = req.body.codegroup;
    }
    if (req.body.prodgroup != null) {
        res.reportedProblem.prodgroup = req.body.prodgroup;
    }
    if (req.body.name != null) {
        res.reportedProblem.name = req.body.name;
    }
    if (req.body.shorttextforcode != null) {
        res.reportedProblem.shorttextforcode = req.body.shorttextforcode;
    }
    if (req.body.status != null) {
        res.reportedProblem.status = req.body.status;
    }
    try {
        const updatedReportedProblem = await res.reportedProblem.save();
        res.json(updatedReportedProblem);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a reported problem
router.delete('/reportedproblem/:id', async (req, res) => {
    try {
        const deletedreportedproblem = await ReportedProblem.deleteOne({ _id: req.params.id })
        if (deletedreportedproblem.deletedCount === 0) {
            res.status(404).json({ message: 'ReportedProblem Not found' })
        }

        res.json({ message: 'Deleted reported problem' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
