const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Import the ProblemType model
const ProblemType = require('../../Model/ComplaintSchema/ProblemTypeSchema');

// ------------------------
// GET all problem types (only active by default)
// ------------------------
router.get('/problemtype', async (req, res) => {
    try {
        const problemtypes = await ProblemType.find({ status: { $ne: "Inactive" } });
        const total = await ProblemType.countDocuments({ status: { $ne: "Inactive" } });

        res.status(200).json({ problemtypes, total });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/pageproblemtype', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Current page number, defaulting to 1
        const limit = parseInt(req.query.limit) || 10; // Number of documents per page, defaulting to 10

        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        const productGroups = await ProblemType.find().skip(skip).limit(limit); // Fetch Product Groups for the current page
        const totalProductGroups = await ProblemType.countDocuments(); // Total number of Product Groups

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
// GET a single problem type by ID
// ------------------------
router.get('/problemtype/:id', async (req, res) => {
    try {
        const problemtype = await ProblemType.findById(req.params.id);
        if (!problemtype) {
            return res.status(404).json({ message: 'Problem type not found' });
        }
        res.status(200).json(problemtype);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ------------------------
// SEARCH problem types by name (case-insensitive)
// ------------------------
router.get('/problemtype/search/:query', async (req, res) => {
    try {
        const query = req.params.query;
        const results = await ProblemType.find({
            name: { $regex: query, $options: 'i' },
            status: { $ne: false }
        });
        res.status(200).json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ------------------------
// CREATE a new problem type
// ------------------------
router.post('/problemtype', async (req, res) => {
    try {
        const newProblemType = new ProblemType(req.body);
        const savedProblemType = await newProblemType.save();
        res.status(201).json(savedProblemType);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ------------------------
// UPDATE an existing problem type by ID
// ------------------------
router.put('/problemtype/:id', async (req, res) => {
    try {
        const updatedProblemType = await ProblemType.findByIdAndUpdate(
            req.params.id,
            { ...req.body, modifiedAt: Date.now() },
            { new: true } // Return the updated document
        );
        if (!updatedProblemType) {
            return res.status(404).json({ message: 'Problem type not found' });
        }
        res.status(200).json(updatedProblemType);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ------------------------
// DELETE a problem type by ID (soft delete: mark status false)
// ------------------------
router.delete('/problemtype/:id', async (req, res) => {
    try {
        const deletedProblemType = await ProblemType.findByIdAndUpdate(
            req.params.id,
            { status: false, modifiedAt: Date.now() },
            { new: true }
        );
        if (!deletedProblemType) {
            return res.status(404).json({ message: 'Problem type not found' });
        }
        res.status(200).json({ message: 'Problem type marked as inactive', deletedProblemType });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
