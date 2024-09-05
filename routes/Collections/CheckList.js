const express = require('express');
const router = express.Router();
const CheckList = require('../../Model/CollectionSchema/ChecklistSchema');

// Middleware to get checklist by ID
async function getChecklistById(req, res, next) {
    let checklist;
    try {
        checklist = await CheckList.findById(req.params.id);
        if (!checklist) {
            return res.status(404).json({ message: 'Checklist not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.checklist = checklist;
    next();
}

// Middleware to check for duplicates
async function checkDuplicate(req, res, next) {
    const { checklisttype, checkpointtype, checkpoint, prodGroup } = req.body;
    try {
        const existingChecklist = await CheckList.findOne({ checklisttype, checkpointtype, checkpoint, prodGroup });
        if (existingChecklist) {
            return res.status(400).json({ message: 'Duplicate checklist found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}

// GET all checklists
router.get('/checklist', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Current page number, defaulting to 1
        const limit = parseInt(req.query.limit) || 10; // Number of documents per page, defaulting to 10

        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        const checklists = await CheckList.find().skip(skip).limit(limit); // Fetch checklists for the current page
        const totalChecklists = await CheckList.countDocuments(); // Total number of checklists

        const totalPages = Math.ceil(totalChecklists / limit); // Calculate total number of pages

        res.json({
            checklists,
            totalPages,
            totalChecklists
        });
    } catch (err) {
        res.status(500).json({ message: err.message }); // Handle error and return JSON response with status 500 (Internal Server Error)
    }
});

// GET a checklist by ID
router.get('/checklist/:id', getChecklistById, (req, res) => {
    res.json(res.checklist);
});

// CREATE a new checklist
router.post('/checklist', checkDuplicate, async (req, res) => {
    const checklist = new CheckList({
        checklisttype: req.body.checklisttype,
        status: req.body.status,
        checkpointtype: req.body.checkpointtype,
        checkpoint: req.body.checkpoint,
        prodGroup: req.body.prodGroup,
        result: req.body.result,
        resulttype: req.body.resulttype
    });
    try {
        const newChecklist = await checklist.save();
        res.status(201).json(newChecklist);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a checklist
router.put('/checklist/:id', getChecklistById, async (req, res) => {
    if (req.body.checklisttype != null) {
        res.checklist.checklisttype = req.body.checklisttype;
    }
    if (req.body.status != null) {
        res.checklist.status = req.body.status;
    }
    if (req.body.checkpointtype != null) {
        res.checklist.checkpointtype = req.body.checkpointtype;
    }
    if (req.body.checkpoint != null) {
        res.checklist.checkpoint = req.body.checkpoint;
    }
    if (req.body.prodGroup != null) {
        res.checklist.prodGroup = req.body.prodGroup;
    }
    if (req.body.result != null) {
        res.checklist.result = req.body.result;
    }
    if (req.body.resulttype != null) {
        res.checklist.resulttype = req.body.resulttype;
    }

    try {
        const updatedChecklist = await res.checklist.save();
        res.json(updatedChecklist);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a checklist
router.delete('/checklist/:id', async (req, res) => {
    try {
        const deletedChecklist = await CheckList.deleteOne({ _id: req.params.id })
        if (deletedChecklist.deletedCount === 0) {
            return res.status(404).json({ message: 'CheckList Not found' })
        }
        res.json({ message: 'Deleted Checklist' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
