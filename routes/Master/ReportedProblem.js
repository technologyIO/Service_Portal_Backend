const express = require('express');
const router = express.Router();
const ReportedProblem = require('../../Model/MasterSchema/ReportedProblemSchema');

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
     const deletedreportedproblem = await ReportedProblem.deleteOne({_id:req.params.id})
     if(deletedreportedproblem.deletedCount===0){
        res.status(404).json({message:'ReportedProblem Not found'})
     }

        res.json({ message: 'Deleted reported problem' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
