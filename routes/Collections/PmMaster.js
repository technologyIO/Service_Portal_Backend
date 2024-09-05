const express = require('express');
const router = express.Router();
const PmMaster = require('../../Model/CollectionSchema/PMMasterSchema');

async function getChecklistById(req, res, next) {
    let checklist;
    try {
        checklist = await PmMaster.findById(req.params.id);
        if (!checklist) {
            return res.status(404).json({ message: 'Checklist not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.checklist = checklist;
    next();
}

// Middleware to check for valid pmstatus
function validatePmstatus(req, res, next) {
    const validStatuses = ['Comp', 'Due', 'Overdue', 'Lapse'];
    if (!validStatuses.includes(req.body.pmstatus)) {
        return res.status(400).json({ message: 'Invalid pmstatus value' });
    }
    next();
}

// GET all checklists
router.get('/pmmaster', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Current page number, defaulting to 1
        const limit = parseInt(req.query.limit) || 10; // Number of documents per page, defaulting to 10

        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        const pmMasters = await PmMaster.find().skip(skip).limit(limit); // Fetch PM Masters for the current page
        const totalPmMasters = await PmMaster.countDocuments(); // Total number of PM Masters

        const totalPages = Math.ceil(totalPmMasters / limit); // Calculate total number of pages

        res.json({
            pmMasters,
            totalPages,
            totalPmMasters
        });
    } catch (err) {
        res.status(500).json({ message: err.message }); // Handle error and return JSON response with status 500 (Internal Server Error)
    }
});

// GET a checklist by ID
router.get('/pmmaster/:id', getChecklistById, (req, res) => {
    res.json(res.checklist);
});

// CREATE a new checklist
router.post('/pmmaster', validatePmstatus, async (req, res) => {
    const checklist = new PmMaster({
        pmtype: req.body.pmtype,
        status: req.body.status,
        pmumber: req.body.pmumber,
        documentnumber: req.body.documentnumber,
        materialdescription: req.body.materialdescription,
        serialnumber: req.body.serialnumber,
        customercode: req.body.customercode,
        region: req.body.region,
        pmduemonth: req.body.pmduemonth,
        pmdonedate: req.body.pmdonedate,
        pmvendorcode: req.body.pmvendorcode,
        pmengineercode: req.body.pmengineercode,
        pmstatus: req.body.pmstatus,
        assignedto: req.body.assignedto,
        assignedby: req.body.assignedby
    });
    try {
        const newChecklist = await checklist.save();
        res.status(201).json(newChecklist);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a checklist
router.put('/pmmaster/:id', getChecklistById, validatePmstatus, async (req, res) => {
    if (req.body.pmtype != null) {
        res.checklist.pmtype = req.body.pmtype;
    }
    if (req.body.status != null) {
        res.checklist.status = req.body.status;
    }
    if (req.body.pmumber != null) {
        res.checklist.pmumber = req.body.pmumber;
    }
    if (req.body.documentnumber != null) {
        res.checklist.documentnumber = req.body.documentnumber;
    }
    if (req.body.materialdescription != null) {
        res.checklist.materialdescription = req.body.materialdescription;
    }
    if (req.body.serialnumber != null) {
        res.checklist.serialnumber = req.body.serialnumber;
    }
    if (req.body.customercode != null) {
        res.checklist.customercode = req.body.customercode;
    }
    if (req.body.region != null) {
        res.checklist.region = req.body.region;
    }
    if (req.body.pmduemonth != null) {
        res.checklist.pmduemonth = req.body.pmduemonth;
    }
    if (req.body.pmdonedate != null) {
        res.checklist.pmdonedate = req.body.pmdonedate;
    }
    if (req.body.pmvendorcode != null) {
        res.checklist.pmvendorcode = req.body.pmvendorcode;
    }
    if (req.body.pmengineercode != null) {
        res.checklist.pmengineercode = req.body.pmengineercode;
    }
    if (req.body.pmstatus != null) {
        res.checklist.pmstatus = req.body.pmstatus;
    }
    if (req.body.assignedto != null) {
        res.checklist.assignedto = req.body.assignedto;
    }
    if (req.body.assignedby != null) {
        res.checklist.assignedby = req.body.assignedby;
    }

    try {
        const updatedChecklist = await res.checklist.save();
        res.json(updatedChecklist);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a checklist
router.delete('/pmmaster/:id', async (req, res) => {
    try {
        const deletepmmaster = await PmMaster.deleteOne({ _id: req.params.id })
        if (deletepmmaster.deletedCount === 0) {
            res.json({ message: "PmMaster Not Found" })
        }
        res.json({ message: 'Deleted PmMaster' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
