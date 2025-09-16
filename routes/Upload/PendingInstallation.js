const express = require('express');
const router = express.Router();
const PendingInstallation = require('../../Model/UploadSchema/PendingInstallationSchema');
const WarrantyCode = require('../../Model/MasterSchema/WarrantyCodeSchema');
const User = require('../../Model/MasterSchema/UserSchema');
const Aerb = require('../../Model/MasterSchema/AerbSchema');
const Product = require('../../Model/MasterSchema/ProductSchema');
const PMDocMaster = require('../../Model/MasterSchema/pmDocMasterSchema');
const Customer = require('../../Model/UploadSchema/CustomerSchema');
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

router.get('/pendinginstallations/filter-options', async (req, res) => {
    try {
        const pendingInstallations = await PendingInstallation.find({}, {
            distchnl: 1,
            customercity: 1,
            material: 1,
            salesdist: 1,
            salesoff: 1,
            customercountry: 1
        });

        const distChannels = [...new Set(pendingInstallations.map(pi => pi.distchnl).filter(Boolean))];
        const customerCities = [...new Set(pendingInstallations.map(pi => pi.customercity).filter(Boolean))];
        const materials = [...new Set(pendingInstallations.map(pi => pi.material).filter(Boolean))];
        const salesDistricts = [...new Set(pendingInstallations.map(pi => pi.salesdist).filter(Boolean))];
        const salesOffices = [...new Set(pendingInstallations.map(pi => pi.salesoff).filter(Boolean))];
        const customerCountries = [...new Set(pendingInstallations.map(pi => pi.customercountry).filter(Boolean))];

        res.json({
            distChannels: distChannels.sort(),
            customerCities: customerCities.sort(),
            materials: materials.sort(),
            salesDistricts: salesDistricts.sort(),
            salesOffices: salesOffices.sort(),
            customerCountries: customerCountries.sort()
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET pending installations with filters - FIXED STATUS FILTERING
router.get('/pendinginstallations/filter', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filters = {};

        // Invoice No filter
        if (req.query.invoiceno) {
            filters.invoiceno = { $regex: req.query.invoiceno, $options: 'i' };
        }

        // Distribution Channel filter
        if (req.query.distchnl) {
            filters.distchnl = req.query.distchnl;
        }

        // Customer ID filter
        if (req.query.customerid) {
            filters.customerid = { $regex: req.query.customerid, $options: 'i' };
        }

        // Customer Name 1 filter
        if (req.query.customername1) {
            filters.customername1 = { $regex: req.query.customername1, $options: 'i' };
        }

        // Customer Name 2 filter
        if (req.query.customername2) {
            filters.customername2 = { $regex: req.query.customername2, $options: 'i' };
        }

        // Customer City filter
        if (req.query.customercity) {
            filters.customercity = req.query.customercity;
        }

        // Customer Postal Code filter
        if (req.query.customerpostalcode) {
            filters.customerpostalcode = { $regex: req.query.customerpostalcode, $options: 'i' };
        }

        // Material filter
        if (req.query.material) {
            filters.material = req.query.material;
        }

        // Description filter
        if (req.query.description) {
            filters.description = { $regex: req.query.description, $options: 'i' };
        }

        // Serial Number filter
        if (req.query.serialnumber) {
            filters.serialnumber = { $regex: req.query.serialnumber, $options: 'i' };
        }

        // Sales District filter
        if (req.query.salesdist) {
            filters.salesdist = req.query.salesdist;
        }

        // Sales Office filter
        if (req.query.salesoff) {
            filters.salesoff = req.query.salesoff;
        }

        // Customer Country filter
        if (req.query.customercountry) {
            filters.customercountry = req.query.customercountry;
        }

        // Customer Region filter
        if (req.query.customerregion) {
            filters.customerregion = { $regex: req.query.customerregion, $options: 'i' };
        }

        // Current Customer ID filter
        if (req.query.currentcustomerid) {
            filters.currentcustomerid = { $regex: req.query.currentcustomerid, $options: 'i' };
        }

        // PAL Number filter
        if (req.query.palnumber) {
            filters.palnumber = { $regex: req.query.palnumber, $options: 'i' };
        }

        // Material Group 4 filter
        if (req.query.mtl_grp4) {
            filters.mtl_grp4 = { $regex: req.query.mtl_grp4, $options: 'i' };
        }

        // Key filter
        if (req.query.key) {
            filters.key = { $regex: req.query.key, $options: 'i' };
        }

        // ✅ FIXED: Status filter with case-insensitive matching
        if (req.query.status) {
            filters.status = new RegExp(`^${req.query.status}$`, 'i');
        }

        // Invoice date range filter
        if (req.query.invoiceDateFrom || req.query.invoiceDateTo) {
            filters.invoicedate = {};
            if (req.query.invoiceDateFrom) {
                filters.invoicedate.$gte = new Date(req.query.invoiceDateFrom);
            }
            if (req.query.invoiceDateTo) {
                const endDate = new Date(req.query.invoiceDateTo);
                endDate.setHours(23, 59, 59, 999);
                filters.invoicedate.$lte = endDate;
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

        const totalPendingInstallations = await PendingInstallation.countDocuments(filters);
        const pendingInstallations = await PendingInstallation.find(filters)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const totalPages = Math.ceil(totalPendingInstallations / limit);

        res.json({
            pendingInstallations,
            totalPendingInstallations,
            totalPages,
            currentPage: page,
            filters: req.query
        });
    } catch (err) {
        console.error('Filter error:', err);
        res.status(500).json({ message: err.message });
    }
});

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
        const { serialnumber } = req.params;

        // 1) Find pending installation by serial
        const pending = await PendingInstallation.findOne({ serialnumber }).lean();
        if (!pending) {
            return res.status(404).json({ message: 'No Pending Installation found with the provided serial number.' });
        }

        // 2) Prepare lookups (in parallel)
        const [warrantyCode, aerbRecord, customer] = await Promise.all([
            pending.mtl_grp4 ? WarrantyCode.findOne({ warrantycodeid: pending.mtl_grp4 }).lean() : null,
            pending.material ? Aerb.findOne({ materialcode: pending.material }).lean() : null,
            // 3) Match currentcustomerid -> Customer.customercodeid
            pending.currentcustomerid
                ? Customer.findOne({ customercodeid: String(pending.currentcustomerid).trim() }).lean()
                : null
        ]);

        // 4) Build response
        const resp = {
            ...pending,
            warrantyMonths: warrantyCode?.months || 0,
            Customer: customer?.customername || "N/A",
            City: customer?.city || "N/A",
            PinCode: customer?.postalcode || "N/A",
        };

        // Hide palnumber if not in AERB
        if (!aerbRecord) delete resp.palnumber;

        return res.json(resp);
    } catch (err) {
        return res.status(500).json({ message: err.message || 'Server error' });
    }
});




router.get('/pendinginstallations/user-serialnumbers/:employeeid', async (req, res) => {
    try {
        const employeeid = req.params.employeeid;
        const { search, limit = 100, skip = 0 } = req.query;





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

        // 3. Build query for pending installations (exclude inactive)
        let query = {
            material: { $in: partNumbers },
            status: { $ne: "Inactive" }  // ✅ exclude inactive
        };



        // Add search functionality if search term is provided
        if (search && search.trim()) {
            query.serialnumber = {
                $regex: search.trim(),
                $options: 'i' // Case insensitive
            };

        }

        // 4. Get total count for pagination info

        const totalCount = await PendingInstallation.countDocuments(query);

        // 5. Find installations with pagination and search
        const installations = await PendingInstallation.find(query, 'serialnumber')
            .sort({ serialnumber: 1 }) // Sort alphabetically
            .skip(parseInt(skip))
            .limit(parseInt(limit));

        if (installations.length === 0) {
            const message = search
                ? 'No installations found matching search criteria'
                : 'No installations found matching user skills';

            return res.status(404).json({
                message,
                serialNumbers: [],
                pagination: {
                    total: totalCount,
                    skip: parseInt(skip),
                    limit: parseInt(limit),
                    hasMore: false
                }
            });
        }

        // 6. Extract serial numbers
        const serialNumbers = installations.map(inst => inst.serialnumber);

        // 7. Calculate pagination info
        const hasMore = (parseInt(skip) + parseInt(limit)) < totalCount;

        const responseData = {
            serialNumbers,
            pagination: {
                total: totalCount,
                skip: parseInt(skip),
                limit: parseInt(limit),
                hasMore,
                returned: serialNumbers.length
            }
        };

        res.json(responseData);

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
router.put('/pendinginstallations/:id', getPendingInstallationById, async (req, res) => {
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
