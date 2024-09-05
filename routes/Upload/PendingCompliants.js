const express = require('express');
const router = express.Router();
const PendingComplaints = require('../../Model/UploadSchema/PendingCompliantsSchema');

// Middleware to get a PendingComplaint by ID
async function getPendingComplaintById(req, res, next) {
    let pendingComplaint;
    try {
        pendingComplaint = await PendingComplaints.findById(req.params.id);
        if (!pendingComplaint) {
            return res.status(404).json({ message: 'Pending Complaint not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.pendingComplaint = pendingComplaint;
    next();
}

// Middleware to check for duplicate notification_complaintid
async function checkDuplicateComplaintId(req, res, next) {
    let pendingComplaint;
    try {
        pendingComplaint = await PendingComplaints.findOne({
            notification_complaintid: req.body.notification_complaintid
        });
        if (pendingComplaint && pendingComplaint._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate complaint ID found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}

// GET all PendingComplaints
router.get('/pendingcomplaints', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const pendingComplaints = await PendingComplaints.find().skip(skip).limit(limit);
        const totalPendingComplaints = await PendingComplaints.countDocuments();
        const totalPages = Math.ceil(totalPendingComplaints / limit);

        res.json({
            pendingComplaints,
            totalPages,
            totalPendingComplaints
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// GET PendingComplaint by ID
router.get('/pendingcomplaints/:id', getPendingComplaintById, (req, res) => {
    res.json(res.pendingComplaint);
});

// CREATE a new PendingComplaint
router.post('/pendingcomplaints', checkDuplicateComplaintId, async (req, res) => {
    const pendingComplaint = new PendingComplaints({
        notificationtype: req.body.notificationtype,
        notification_complaintid: req.body.notification_complaintid,
        notificationdate: req.body.notificationdate,
        userstatus: req.body.userstatus,
        materialdescription: req.body.materialdescription,
        serialnumber: req.body.serialnumber,
        devicedata: req.body.devicedata,
        salesoffice: req.body.salesoffice,
        materialcode: req.body.materialcode,
        reportedproblem: req.body.reportedproblem,
        dealercode: req.body.dealercode,
        customercode: req.body.customercode,
        partnerresp: req.body.partnerresp,
        breakdown: req.body.breakdown,
        status: req.body.status
    });
    try {
        const newPendingComplaint = await pendingComplaint.save();
        res.status(201).json(newPendingComplaint);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a PendingComplaint
router.put('/pendingcomplaints/:id', getPendingComplaintById, checkDuplicateComplaintId, async (req, res) => {
    if (req.body.notificationtype != null) {
        res.pendingComplaint.notificationtype = req.body.notificationtype;
    }
    if (req.body.notification_complaintid != null) {
        res.pendingComplaint.notification_complaintid = req.body.notification_complaintid;
    }
    if (req.body.notificationdate != null) {
        res.pendingComplaint.notificationdate = req.body.notificationdate;
    }
    if (req.body.userstatus != null) {
        res.pendingComplaint.userstatus = req.body.userstatus;
    }
    if (req.body.materialdescription != null) {
        res.pendingComplaint.materialdescription = req.body.materialdescription;
    }
    if (req.body.serialnumber != null) {
        res.pendingComplaint.serialnumber = req.body.serialnumber;
    }
    if (req.body.devicedata != null) {
        res.pendingComplaint.devicedata = req.body.devicedata;
    }
    if (req.body.salesoffice != null) {
        res.pendingComplaint.salesoffice = req.body.salesoffice;
    }
    if (req.body.materialcode != null) {
        res.pendingComplaint.materialcode = req.body.materialcode;
    }
    if (req.body.reportedproblem != null) {
        res.pendingComplaint.reportedproblem = req.body.reportedproblem;
    }
    if (req.body.dealercode != null) {
        res.pendingComplaint.dealercode = req.body.dealercode;
    }
    if (req.body.customercode != null) {
        res.pendingComplaint.customercode = req.body.customercode;
    }
    if (req.body.partnerresp != null) {
        res.pendingComplaint.partnerresp = req.body.partnerresp;
    }
    if (req.body.breakdown != null) {
        res.pendingComplaint.breakdown = req.body.breakdown;
    }
    if (req.body.status != null) {
        res.pendingComplaint.status = req.body.status;
    }
    res.pendingComplaint.modifiedAt = Date.now();
    try {
        const updatedPendingComplaint = await res.pendingComplaint.save();
        res.json(updatedPendingComplaint);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a PendingComplaint
router.delete('/pendingcomplaints/:id', getPendingComplaintById, async (req, res) => {
    try {
        const deletedPendingComplaint = await PendingComplaints.deleteOne({ _id: req.params.id });
        if (deletedPendingComplaint.deletedCount === 0) {
            return res.status(404).json({ message: 'Pending Complaint Not Found' });
        }
        res.json({ message: 'Deleted Pending Complaint' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
