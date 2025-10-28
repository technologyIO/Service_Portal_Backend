const express = require('express');
const router = express.Router();
const HubStock = require('../../Model/UploadSchema/HubStockSchema');
const DealerStock = require('../../Model/UploadSchema/DealerStockSchema');
const mongoose = require('mongoose');

// Middleware to get a HubStock by ID
async function getHubStockById(req, res, next) {
    let hubStock;
    try {
        hubStock = await HubStock.findById(req.params.id);
        if (!hubStock) {
            return res.status(404).json({ message: 'HubStock not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.hubStock = hubStock;
    next();
}

// Middleware to check for duplicate materialcode
async function checkDuplicateMaterialCode(req, res, next) {
    let hubStock;
    try {
        hubStock = await HubStock.findOne({
            materialcode: req.body.materialcode
        });
        if (hubStock && hubStock._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate material code found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}
router.get('/hubstocks/filter-options', async (req, res) => {
    try {
        const hubStocks = await HubStock.find({}, {
            materialcode: 1,
            storagelocation: 1
        });

        const materialCodes = [...new Set(hubStocks.map(hs => hs.materialcode).filter(Boolean))];
        const storageLocations = [...new Set(hubStocks.map(hs => hs.storagelocation).filter(Boolean))];

        res.json({
            materialCodes: materialCodes.sort(),
            storageLocations: storageLocations.sort()
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET hub stocks with filters - FIXED STATUS FILTERING
router.get('/hubstocks/filter', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filters = {};

        // Material Code filter
        if (req.query.materialcode) {
            filters.materialcode = req.query.materialcode;
        }

        // Material Description filter
        if (req.query.materialdescription) {
            filters.materialdescription = { $regex: req.query.materialdescription, $options: 'i' };
        }

        // Exact Quantity filter
        if (req.query.quantity) {
            filters.quantity = Number(req.query.quantity);
        }

        // Quantity range filters
        if (req.query.quantityMin || req.query.quantityMax) {
            filters.quantity = {};
            if (req.query.quantityMin) {
                filters.quantity.$gte = Number(req.query.quantityMin);
            }
            if (req.query.quantityMax) {
                filters.quantity.$lte = Number(req.query.quantityMax);
            }
        }

        // Storage Location filter
        if (req.query.storagelocation) {
            filters.storagelocation = req.query.storagelocation;
        }

        // ✅ FIXED: Status filter with case-insensitive matching
        if (req.query.status) {
            // Use case-insensitive regex for exact match
            filters.status = new RegExp(`^${req.query.status}$`, 'i');
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
            filters.updatedAt = {};
            if (req.query.modifiedStartDate) {
                filters.updatedAt.$gte = new Date(req.query.modifiedStartDate);
            }
            if (req.query.modifiedEndDate) {
                const endDate = new Date(req.query.modifiedEndDate);
                endDate.setHours(23, 59, 59, 999);
                filters.updatedAt.$lte = endDate;
            }
        }

        console.log('Applied Filters:', filters); // Debug log

        const totalHubStocks = await HubStock.countDocuments(filters);
        const hubStocks = await HubStock.find(filters)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const totalPages = Math.ceil(totalHubStocks / limit);

        res.json({
            hubStocks,
            totalHubStocks,
            totalPages,
            currentPage: page,
            filters: req.query
        });
    } catch (err) {
        console.error('Filter error:', err);
        res.status(500).json({ message: err.message });
    }
});
// BULK DELETE Hub Stock entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/hubstocks/bulk', async (req, res) => {
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

        // Delete multiple hub stocks
        const deleteResult = await HubStock.deleteMany({
            _id: { $in: validIds }
        });

        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({
                message: 'No hub stocks found to delete',
                deletedCount: 0
            });
        }

        res.json({
            message: `Successfully deleted ${deleteResult.deletedCount} hub stocks`,
            deletedCount: deleteResult.deletedCount,
            requestedCount: validIds.length
        });

    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/hubstocks', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const hubStocks = await HubStock.find().skip(skip).limit(limit);
        const totalHubStocks = await HubStock.countDocuments();
        const totalPages = Math.ceil(totalHubStocks / limit);

        res.json({
            hubStocks,
            totalPages,
            totalHubStocks
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/hubstocks/material-list', async (req, res) => {
    try {
        const results = await HubStock.aggregate([
            {
                $match: { status: { $ne: "Inactive" } } // Exclude inactive materials
            },
            {
                $group: {
                    _id: {
                        materialcode: '$materialcode',
                        materialdescription: '$materialdescription'
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    materialcode: '$_id.materialcode',
                    materialdescription: '$_id.materialdescription'
                }
            }
        ]);

        res.json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.get('/hubstocks/check-material/:materialcode', async (req, res) => {
    try {
        const { materialcode } = req.params;

        // 1) Fetch matching documents from HubStock (only active)
        const hubStockData = await HubStock.find(
            { materialcode, status: { $ne: "Inactive" } },
            { storagelocation: 1, quantity: 1, _id: 0 }
        );

        // 2) Fetch matching documents from DealerStock (only active)
        const dealerStockData = await DealerStock.find(
            { materialcode, status: { $ne: "Inactive" } },
            { dealername: 1, dealercity: 1, unrestrictedquantity: 1, _id: 0 }
        );

        // 3) Send both results back
        res.json({ hubStockData, dealerStockData });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



// GET HubStock by ID
router.get('/hubstocks/:id', getHubStockById, (req, res) => {
    res.json(res.hubStock);
});

// CREATE a new HubStock
router.post('/hubstocks', checkDuplicateMaterialCode, async (req, res) => {
    const hubStock = new HubStock({
        materialcode: req.body.materialcode,
        materialdescription: req.body.materialdescription,
        quantity: req.body.quantity,
        storagelocation: req.body.storagelocation,
        status: req.body.status
    });
    try {
        const newHubStock = await hubStock.save();
        res.status(201).json(newHubStock);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a HubStock
router.put('/hubstocks/:id', getHubStockById, checkDuplicateMaterialCode, async (req, res) => {
    if (req.body.materialcode != null) {
        res.hubStock.materialcode = req.body.materialcode;
    }
    if (req.body.materialdescription != null) {
        res.hubStock.materialdescription = req.body.materialdescription;
    }
    if (req.body.quantity != null) {
        res.hubStock.quantity = req.body.quantity;
    }
    if (req.body.storagelocation != null) {
        res.hubStock.storagelocation = req.body.storagelocation;
    }
    if (req.body.status != null) {
        res.hubStock.status = req.body.status;
    }
    res.hubStock.updatedAt = Date.now();
    try {
        const updatedHubStock = await res.hubStock.save();
        res.json(updatedHubStock);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a HubStock
router.delete('/hubstocks/:id', getHubStockById, async (req, res) => {
    try {
        const deletedHubStock = await HubStock.deleteOne({ _id: req.params.id });
        if (deletedHubStock.deletedCount === 0) {
            return res.status(404).json({ message: 'HubStock Not Found' });
        }
        res.json({ message: 'Deleted HubStock' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/hubstocksearch', async (req, res) => {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        if (!q) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const isNumeric = !isNaN(q); // Check if the query is a numeric value

        const query = {
            $or: [
                { materialcode: { $regex: q, $options: 'i' } },
                { materialdescription: { $regex: q, $options: 'i' } },
                ...(isNumeric ? [{ quantity: Number(q) }] : []), // Add numeric search for quantity
                { storagelocation: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } }
            ]
        };

        const hubStocks = await HubStock.find(query).skip(skip).limit(limit);
        const totalHubStocks = await HubStock.countDocuments(query);
        const totalPages = Math.ceil(totalHubStocks / limit);

        res.json({
            hubStocks,
            totalPages,
            totalHubStocks,
            currentPage: page,
            isSearch: true
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



module.exports = router;
