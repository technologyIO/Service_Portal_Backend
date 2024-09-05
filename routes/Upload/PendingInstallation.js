const express = require('express');
const router = express.Router();
const PendingInstallation = require('../../Model/UploadSchema/PendingInstallationSchema');

// Middleware to get a PendingInstallation by ID
async function getPendingInstallationById(req, res, next) {
    let pendingInstallation;
    try {
        pendingInstallation = await PendingInstallation.findById(req.params.id);
        if (!pendingInstallation) {
            return res.status(404).json({ message: 'Pending Installation not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.pendingInstallation = pendingInstallation;
    next();
}

// Middleware to check for duplicate invoiceno
async function checkDuplicateInvoiceNo(req, res, next) {
    let pendingInstallation;
    try {
        pendingInstallation = await PendingInstallation.findOne({
            invoiceno: req.body.invoiceno
        });
        if (pendingInstallation && pendingInstallation._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate invoice number found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}

// GET all PendingInstallations
router.get('/pendinginstallations', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const pendingInstallations = await PendingInstallation.find().skip(skip).limit(limit);
        const totalPendingInstallations = await PendingInstallation.countDocuments();
        const totalPages = Math.ceil(totalPendingInstallations / limit);

        res.json({
            pendingInstallations,
            totalPages,
            totalPendingInstallations
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET PendingInstallation by ID
router.get('/pendinginstallations/:id', getPendingInstallationById, (req, res) => {
    res.json(res.pendingInstallation);
});

// CREATE a new PendingInstallation
router.post('/pendinginstallations', checkDuplicateInvoiceNo, async (req, res) => {
    try {
        // Check if the serial number already exists
        const existingInstallation = await PendingInstallation.findOne({ serialnumber: req.body.serialnumber });
        if (existingInstallation) {
            return res.status(400).json({ message: 'Serial number already exists.' });
        }

        // If serial number is unique, create a new record
        const pendingInstallation = new PendingInstallation({
            invoiceno: req.body.invoiceno,
            invoicedate: req.body.invoicedate,
            distchnl: req.body.distchnl,
            customerid: req.body.customerid,
            customername1: req.body.customername1,
            customername2: req.body.customername2,
            customercity: req.body.customercity,
            customerpostalcode: req.body.customerpostalcode,
            material: req.body.material,
            description: req.body.description,
            serialnumber: req.body.serialnumber,
            salesdist: req.body.salesdist,
            salesoff: req.body.salesoff,
            customercountry: req.body.customercountry,
            customerregion: req.body.customerregion,
            currentcustomerid: req.body.currentcustomerid,
            currentcustomername1: req.body.currentcustomername1,
            currentcustomername2: req.body.currentcustomername2,
            currentcustomercity: req.body.currentcustomercity,
            currentcustomerregion: req.body.currentcustomerregion,
            currentcustomerpostalcode: req.body.currentcustomerpostalcode,
            currentcustomercountry: req.body.currentcustomercountry,
            mtl_grp4: req.body.mtl_grp4,
            key: req.body.key,
            palnumber: req.body.palnumber,
            status: req.body.status
        });

        // Save the new pending installation to the database
        const newPendingInstallation = await pendingInstallation.save();
        res.status(201).json(newPendingInstallation);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a PendingInstallation
router.put('/pendinginstallations/:id', getPendingInstallationById, checkDuplicateInvoiceNo, async (req, res) => {
    if (req.body.invoiceno != null) {
        res.pendingInstallation.invoiceno = req.body.invoiceno;
    }
    if (req.body.invoicedate != null) {
        res.pendingInstallation.invoicedate = req.body.invoicedate;
    }
    if (req.body.distchnl != null) {
        res.pendingInstallation.distchnl = req.body.distchnl;
    }
    if (req.body.customerid != null) {
        res.pendingInstallation.customerid = req.body.customerid;
    }
    if (req.body.customername1 != null) {
        res.pendingInstallation.customername1 = req.body.customername1;
    }
    if (req.body.customername2 != null) {
        res.pendingInstallation.customername2 = req.body.customername2;
    }
    if (req.body.customercity != null) {
        res.pendingInstallation.customercity = req.body.customercity;
    }
    if (req.body.customerpostalcode != null) {
        res.pendingInstallation.customerpostalcode = req.body.customerpostalcode;
    }
    if (req.body.material != null) {
        res.pendingInstallation.material = req.body.material;
    }
    if (req.body.description != null) {
        res.pendingInstallation.description = req.body.description;
    }
    if (req.body.serialnumber  != null) {
        res.pendingInstallation.serialnumber  = req.body.serialnumber ;
    }
    if (req.body.salesdist != null) {
        res.pendingInstallation.salesdist = req.body.salesdist;
    }
    if (req.body.salesoff != null) {
        res.pendingInstallation.salesoff = req.body.salesoff;
    }
    if (req.body.customercountry != null) {
        res.pendingInstallation.customercountry = req.body.customercountry;
    }
    if (req.body.customerregion != null) {
        res.pendingInstallation.customerregion = req.body.customerregion;
    }
    if (req.body.currentcustomerid != null) {
        res.pendingInstallation.currentcustomerid = req.body.currentcustomerid;
    }
    if (req.body.currentcustomername1 != null) {
        res.pendingInstallation.currentcustomername1 = req.body.currentcustomername1;
    }
    if (req.body.currentcustomername2 != null) {
        res.pendingInstallation.currentcustomername2 = req.body.currentcustomername2;
    }
    if (req.body.currentcustomercity != null) {
        res.pendingInstallation.currentcustomercity = req.body.currentcustomercity;
    }
    if (req.body.currentcustomerregion != null) {
        res.pendingInstallation.currentcustomerregion = req.body.currentcustomerregion;
    }
    if (req.body.currentcustomerpostalcode != null) {
        res.pendingInstallation.currentcustomerpostalcode = req.body.currentcustomerpostalcode;
    }
    if (req.body.currentcustomercountry != null) {
        res.pendingInstallation.currentcustomercountry = req.body.currentcustomercountry;
    }
    if (req.body.mtl_grp4 != null) {
        res.pendingInstallation.mtl_grp4 = req.body.mtl_grp4;
    }
    if (req.body.key != null) {
        res.pendingInstallation.key = req.body.key;
    }
    if (req.body.palnumber != null) {
        res.pendingInstallation.palnumber = req.body.palnumber;
    }
    if (req.body.status != null) {
        res.pendingInstallation.status = req.body.status;
    }
    res.pendingInstallation.modifiedAt = Date.now();
    try {
        const updatedPendingInstallation = await res.pendingInstallation.save();
        res.json(updatedPendingInstallation);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a PendingInstallation
router.delete('/pendinginstallations/:id', getPendingInstallationById, async (req, res) => {
    try {
        const deletedPendingInstallation = await PendingInstallation.deleteOne({ _id: req.params.id });
        if (deletedPendingInstallation.deletedCount === 0) {
            return res.status(404).json({ message: 'Pending Installation Not Found' });
        }
        res.json({ message: 'Deleted Pending Installation' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
