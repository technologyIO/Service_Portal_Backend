const express = require("express");
const FormatMaster = require("../../Model/MasterSchema/FormatMasterSchema");
const mongoose = require('mongoose');

const router = express.Router();

router.get("/format/paginated", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const formatMasters = await FormatMaster.find().skip(skip).limit(limit);
        const totalFormatMasters = await FormatMaster.countDocuments();
        const totalPages = Math.ceil(totalFormatMasters / limit);

        res.json({
            success: true,
            data: formatMasters,
            totalFormatMasters,
            totalPages,
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create Format Master
router.post("/format", async (req, res) => {
    try {
        const formatMaster = new FormatMaster(req.body);
        await formatMaster.save();
        res.status(201).json({ success: true, data: formatMaster });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Get all Format Masters
router.get("/format", async (req, res) => {
    try {
        const formatMasters = await FormatMaster.find();
        res.json({ success: true, data: formatMasters });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Search route
router.get('/searchformat', async (req, res) => {
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
                { productGroup: { $regex: q, $options: 'i' } },
                { chlNo: { $regex: q, $options: 'i' } },
                { type: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } }
            ]
        };

        // If q is a number, also search by revNo
        if (!isNaN(q)) {
            query.$or.push({ revNo: Number(q) });
        }

        const formatMasters = await FormatMaster.find(query).skip(skip).limit(limit);
        const totalFormatMasters = await FormatMaster.countDocuments(query);
        const totalPages = Math.ceil(totalFormatMasters / limit);

        res.json({
            data: formatMasters,
            totalPages,
            totalFormatMasters,
            currentPage: page,
            isSearch: true
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// BULK DELETE - MOVED TO /format/bulk AND PLACED BEFORE /:id ROUTES
router.delete('/format/bulk', async (req, res) => {
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

        // Delete multiple format masters
        const deleteResult = await FormatMaster.deleteMany({
            _id: { $in: validIds }
        });

        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({
                message: 'No format masters found to delete',
                deletedCount: 0
            });
        }

        res.json({
            message: `Successfully deleted ${deleteResult.deletedCount} format masters`,
            deletedCount: deleteResult.deletedCount,
            requestedCount: validIds.length
        });

    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ message: err.message });
    }
});

// Get Format Master by ID - PLACED AFTER BULK DELETE
router.get("/format/:id", async (req, res) => {
    try {
        const formatMaster = await FormatMaster.findById(req.params.id);
        if (!formatMaster) {
            return res.status(404).json({ success: false, message: "Not found" });
        }
        res.json({ success: true, data: formatMaster });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update Format Master
router.put("/format/:id", async (req, res) => {
    try {
        const formatMaster = await FormatMaster.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!formatMaster) {
            return res.status(404).json({ success: false, message: "Not found" });
        }
        res.json({ success: true, data: formatMaster });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Delete Format Master
router.delete("/format/:id", async (req, res) => {
    try {
        const formatMaster = await FormatMaster.findByIdAndDelete(req.params.id);
        if (!formatMaster) {
            return res.status(404).json({ success: false, message: "Not found" });
        }
        res.json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
