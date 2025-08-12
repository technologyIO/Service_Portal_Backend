const express = require('express');
const router = express.Router();
const PendingInstallation = require('../../Model/UploadSchema/PendingInstallationSchema');
const WarrantyCode = require('../../Model/MasterSchema/WarrantyCodeSchema');
const User = require('../../Model/MasterSchema/UserSchema');
const Aerb = require('../../Model/MasterSchema/AerbSchema');
const Product = require('../../Model/MasterSchema/ProductSchema');
const PMDocMaster = require('../../Model/MasterSchema/pmDocMasterSchema');
const mongoose = require('mongoose');

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

/** 
 * Specific Routes must come before generic parameterized routes.
 */

// BULK DELETE Pending Installation entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/pendinginstallations/bulk', async (req, res) => {
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

        // Delete multiple pending installations
        const deleteResult = await PendingInstallation.deleteMany({
            _id: { $in: validIds }
        });

        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({
                message: 'No pending installations found to delete',
                deletedCount: 0
            });
        }

        res.json({
            message: `Successfully deleted ${deleteResult.deletedCount} pending installations`,
            deletedCount: deleteResult.deletedCount,
            requestedCount: validIds.length
        });

    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ message: err.message });
    }
});

// GET all serial numbers
router.get('/pendinginstallations/serialnumbers', async (req, res) => {
    try {
        const equipment = await PendingInstallation.find({}, 'serialnumber');
        const serialNumbers = equipment.map(item => item.serialnumber);
        res.json(serialNumbers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET PendingInstallation by Serial Number
router.get('/pendinginstallations/serial/:serialnumber', async (req, res) => {
    try {
        const serialnumber = req.params.serialnumber;
        const pendingInstallation = await PendingInstallation.findOne({ serialnumber: serialnumber });
        if (!pendingInstallation) {
            return res.status(404).json({ message: 'No Pending Installation found with the provided serial number.' });
        }

        // WarrantyCode ke liye mtl_grp4 field ka use karke match karein
        const warrantyCode = await WarrantyCode.findOne({ warrantycodeid: pendingInstallation.mtl_grp4 });
        const warrantyMonths = warrantyCode?.months || 0;

        // Pending installation object ko convert karein aur warrantyMonths add karein
        const pendingInstallationObj = pendingInstallation.toObject();
        pendingInstallationObj.warrantyMonths = warrantyMonths;

        // Aerb collection se check karein: agar pending installation ka material Aerb ke materialcode se match karta hai,
        // to palnumber field ko show karenge; agar match nahi hota, to ise remove kar denge.
        const aerbRecord = await Aerb.findOne({ materialcode: pendingInstallation.material });
        if (!aerbRecord) {
            delete pendingInstallationObj.palnumber;
        }

        res.json(pendingInstallationObj);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// GET all serial numbers for installations matching user's skill part numbers
// GET all serial numbers for installations matching user's skill part numbers (simplified version)
router.get('/pendinginstallations/user-serialnumbers/:employeeid', async (req, res) => {
    try {
        const employeeid = req.params.employeeid;

        // 1. Find the user by employee ID
        const user = await User.findOne({ employeeid: employeeid });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 2. Extract all part numbers from user's skills
        const partNumbers = [];
        user.skills.forEach(skill => {
            if (skill.partNumbers && skill.partNumbers.length > 0) {
                partNumbers.push(...skill.partNumbers);
            }
        });

        if (partNumbers.length === 0) {
            return res.status(404).json({ message: 'No part numbers found in user skills' });
        }

        // 3. Find pending installations where material matches any part number
        const installations = await PendingInstallation.find({
            material: { $in: partNumbers }
        }, 'serialnumber'); // Only get serialnumber field

        if (installations.length === 0) {
            return res.status(404).json({ message: 'No installations found matching user skills' });
        }

        // 4. Extract just the serial numbers into an array
        const serialNumbers = installations.map(inst => inst.serialnumber);

        res.json(serialNumbers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE PendingInstallation by Serial Number
router.delete('/pendinginstallations/serial/:serialnumber', async (req, res) => {
    try {
        const serialnumber = req.params.serialnumber;
        const result = await PendingInstallation.deleteOne({ serialnumber: serialnumber });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Pending Installation with the given serial number not found.' });
        }
        res.json({ message: 'Deleted Pending Installation successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


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
    if (req.body.serialnumber != null) {
        res.pendingInstallation.serialnumber = req.body.serialnumber;
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
router.get('/installationdoc/by-part/:partnoid', async (req, res) => {
    try {
        const partnoid = req.params.partnoid;

        // Step 1: Find the product using partnoid
        const product = await Product.findOne({ partnoid });
        if (!product) {
            return res.status(404).json({ message: 'Product not found for the provided part number' });
        }

        // Step 2: Extract product group
        const productGroup = product.productgroup;

        // Step 3: Find Installation Doc Master entries matching product group and type "IN"
        const installationDocs = await PMDocMaster.find({
            productGroup: productGroup,
            type: 'IN'
        }).select('chlNo revNo type status createdAt modifiedAt');

        res.json({
            productGroup,
            installationDocs
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
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

router.get('/pendinginstallationsearch', async (req, res) => {
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
                { invoiceno: { $regex: q, $options: 'i' } },
                { distchnl: { $regex: q, $options: 'i' } },
                { customerid: { $regex: q, $options: 'i' } },
                { customername1: { $regex: q, $options: 'i' } },
                { customername2: { $regex: q, $options: 'i' } },
                { customercity: { $regex: q, $options: 'i' } },
                { customerpostalcode: { $regex: q, $options: 'i' } },
                { material: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { serialnumber: { $regex: q, $options: 'i' } },
                { salesdist: { $regex: q, $options: 'i' } },
                { salesoff: { $regex: q, $options: 'i' } },
                { customercountry: { $regex: q, $options: 'i' } },
                { customerregion: { $regex: q, $options: 'i' } },
                { currentcustomerid: { $regex: q, $options: 'i' } },
                { currentcustomername1: { $regex: q, $options: 'i' } },
                { currentcustomername2: { $regex: q, $options: 'i' } },
                { currentcustomercity: { $regex: q, $options: 'i' } },
                { currentcustomerregion: { $regex: q, $options: 'i' } },
                { currentcustomerpostalcode: { $regex: q, $options: 'i' } },
                { currentcustomercountry: { $regex: q, $options: 'i' } },
                { mtl_grp4: { $regex: q, $options: 'i' } },
                { palnumber: { $regex: q, $options: 'i' } },
                { key: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } }
            ]
        };

        const pendingInstallations = await PendingInstallation.find(query).skip(skip).limit(limit);
        const totalPendingInstallations = await PendingInstallation.countDocuments(query);
        const totalPages = Math.ceil(totalPendingInstallations / limit);

        res.json({
            pendingInstallations,
            totalPages,
            totalPendingInstallations,
            currentPage: page,
            isSearch: true
        });
    } catch (err) {
        res.status(500).json({
            message: err.message,
            pendingInstallations: [],
            totalPages: 1,
            totalPendingInstallations: 0,
            currentPage: 1
        });
    }
});


module.exports = router;
