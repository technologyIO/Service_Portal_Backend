const express = require('express');
const router = express.Router();
const ProblemName = require('../../Model/ComplaintSchema/ProblemName');

// ------------------------
// GET all problem names (only active)
// ------------------------
router.get('/problemname', async (req, res) => {
    try {
        const problemnames = await ProblemName.find({ status: { $ne: "Inactive" } });
        const total = await ProblemName.countDocuments({ status: { $ne: "Inactive" } });

        res.status(200).json({ problemnames, total });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/pageproblemname', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Current page number, defaulting to 1
        const limit = parseInt(req.query.limit) || 10; // Number of documents per page, defaulting to 10

        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        const productGroups = await ProblemName.find().skip(skip).limit(limit); // Fetch Product Groups for the current page
        const totalProductGroups = await ProblemName.countDocuments(); // Total number of Product Groups

        const totalPages = Math.ceil(totalProductGroups / limit); // Calculate total number of pages

        res.status(200).json({
            productGroups,
            totalPages,
            totalProductGroups
        });
    } catch (err) {
        res.status(500).json({ message: err.message }); // Handle error and return JSON response with status 500 (Internal Server Error)
    }
});
// ------------------------
// GET a single problem name by ID
// ------------------------
router.get('/problemname/:id', async (req, res) => {
    try {
        const problem = await ProblemName.findById(req.params.id);
        if (!problem) {
            return res.status(404).json({ message: 'Problem name not found' });
        }
        res.status(200).json(problem);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ------------------------
// SEARCH problem names by name (case-insensitive)
// ------------------------
router.get('/problemname/search/:query', async (req, res) => {
    try {
        const query = req.params.query;
        const results = await ProblemName.find({
            name: { $regex: query, $options: 'i' },
            status: { $ne: false }
        });
        res.status(200).json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ------------------------
// CREATE a new problem name
// ------------------------
router.post('/problemname', async (req, res) => {
    try {
        const newProblemName = new ProblemName(req.body);
        const savedProblemName = await newProblemName.save();
        res.status(201).json(savedProblemName);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ------------------------
// UPDATE an existing problem name by ID
// ------------------------
router.put('/problemname/:id', async (req, res) => {
    try {
        const updatedProblemName = await ProblemName.findByIdAndUpdate(
            req.params.id,
            { ...req.body, modifiedAt: Date.now() },
            { new: true }
        );
        if (!updatedProblemName) {
            return res.status(404).json({ message: 'Problem name not found' });
        }
        res.status(200).json(updatedProblemName);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ------------------------
// DELETE a problem name by ID (soft delete: mark status false)
// ------------------------
router.delete('/problemname/:id', async (req, res) => {
    try {
        const deletedProblemName = await ProblemName.findByIdAndUpdate(
            req.params.id,
            { status: false, modifiedAt: Date.now() },
            { new: true }
        );
        if (!deletedProblemName) {
            return res.status(404).json({ message: 'Problem name not found' });
        }
        res.status(200).json({ message: 'Problem name marked as inactive', deletedProblemName });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
