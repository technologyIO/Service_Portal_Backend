const express = require('express');
const router = express.Router();
const ComplaintType = require('../../Model/ComplaintSchema/ComplaintTypeSchema');

// CREATE
router.post('/complainttype', async (req, res) => {
    try {
        const complaint = new ComplaintType(req.body);
        const savedComplaint = await complaint.save();
        res.status(201).json(savedComplaint);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get("/complainttype/paginated", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const complaintTypes = await ComplaintType.find().skip(skip).limit(limit);
        const totalComplaintTypes = await ComplaintType.countDocuments();
        const totalPages = Math.ceil(totalComplaintTypes / limit);

        res.status(200).json({
            success: true,
            data: complaintTypes,
            totalComplaintTypes,
            totalPages,
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
router.get("/complainttype/search", async (req, res) => {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        if (!q) {
            return res.status(400).json({ success: false, message: "Query parameter 'q' is required" });
        }

        const searchRegex = new RegExp(q, 'i'); // case-insensitive

        const query = {
            $or: [
                { name: searchRegex },
                { status: { $regex: q, $options: 'i' } } // handles "true"/"false" as string
            ]
        };

        // If q is boolean-like, convert and search explicitly by status
        if (q.toLowerCase() === 'true' || q.toLowerCase() === 'false') {
            query.$or.push({ status: q.toLowerCase() === 'true' });
        }

        const results = await ComplaintType.find(query).skip(skip).limit(limit);
        const totalComplaintTypes = await ComplaintType.countDocuments(query);
        const totalPages = Math.ceil(totalComplaintTypes / limit);

        res.status(200).json({
            success: true,
            data: results,
            totalPages,
            totalComplaintTypes,
            currentPage: page,
            isSearch: true
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// READ ALL
router.get('/complainttype', async (req, res) => {
    try {
        const complaints = await ComplaintType.find();
        const total = await ComplaintType.countDocuments();
        res.status(200).json({ complaints, total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// READ ONE
router.get('/complainttype/:id', async (req, res) => {
    try {
        const complaint = await ComplaintType.findById(req.params.id);
        if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
        res.status(200).json(complaint);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// UPDATE
router.put('/complainttype/:id', async (req, res) => {
    try {
        req.body.modifiedAt = Date.now();
        const updated = await ComplaintType.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ error: 'Complaint not found' });
        res.status(200).json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE
router.delete('/complainttype/:id', async (req, res) => {
    try {
        const deleted = await ComplaintType.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Complaint not found' });
        res.status(200).json({ message: 'Complaint deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;
