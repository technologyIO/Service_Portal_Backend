const express = require('express');
const router = express.Router();
const CheckPointType = require('../../Model/CollectionSchema/CheckPointTypeSchema');

// Middleware function to get a CheckPointType by ID
async function getCountry(req, res, next) {
    try {
        const checkListType = await CheckPointType.findById(req.params.id); // Use a different name
        if (!checkListType) {
            return res.status(404).json({ message: 'CheckPointType not found' });
        }
        res.CheckPointType = checkListType; // Attach CheckPointType object to response
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// Create a new CheckPointType
router.post('/CheckPointType', async (req, res) => {
    try {
        const newCountry = new CheckPointType(req.body);
        const savedCountry = await newCountry.save();
        res.status(201).json(savedCountry); // Return newly created CheckPointType
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get all countries
router.get('/CheckPointType', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Current page number, defaulting to 1
        const limit = parseInt(req.query.limit) || 10; // Number of documents per page, defaulting to 10

        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        const countries = await CheckPointType.find().skip(skip).limit(limit); // Fetch countries for the current page
        const totalCountries = await CheckPointType.countDocuments(); // Total number of countries

        const totalPages = Math.ceil(totalCountries / limit); // Calculate total number of pages

        res.json({
            countries,
            totalPages,
            totalCountries
        });
    } catch (err) {
        res.status(500).json({ message: err.message }); // Handle error and return JSON response with status 500 (Internal Server Error)
    }
});


// Get a single CheckPointType
router.get('/CheckPointType/:id', getCountry, (req, res) => {
    res.json(res.CheckPointType); // Return single CheckPointType fetched by middleware
});

router.get('/allcheckpointtype', async (req, res) => {
    try {
        const checkPointType = await CheckPointType.find();
        // console.log("Fetched checklist types:", checkPointType); // Debug log
        res.json(checkPointType);
    } catch (error) {
        console.error("Error fetching CheckPointType :", error); // Debug log
        res.status(500).json({ message: 'Server Error' });
    }
});


// Update a CheckPointType
router.patch('/CheckPointType/:id', getCountry, async (req, res) => {
    if (req.body.name) {
        res.CheckPointType.name = req.body.name;
    }
    if (req.body.status) {
        res.CheckPointType.status = req.body.status;
    }
    res.CheckPointType.modifiedAt = Date.now(); // Update modifiedAt timestamp
    try {
        const updatedCheckListType = await res.CheckPointType.save();
        res.json(updatedCheckListType); // Return updated CheckPointType
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a CheckPointType
router.delete('/CheckPointType/:id', async (req, res) => {
    try {
        const deletedCheckPointType = await CheckPointType.deleteOne({ _id: req.params.id });
        if (deletedCheckPointType.deletedCount === 0) {
            return res.status(404).json({ message: 'CheckPointType not found' });
        }
        res.json({ message: 'Deleted CheckPointType' }); // Return success message
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/searchCheckPointType', async (req, res) => {
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
                { name: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } },
            ]
        };

        const checkPointTypes = await CheckPointType.find(query).skip(skip).limit(limit);
        const totalCheckPointTypes = await CheckPointType.countDocuments(query);
        const totalPages = Math.ceil(totalCheckPointTypes / limit);

        res.json({
            checkPointTypes,
            totalPages,
            totalCheckPointTypes,
            currentPage: page,
            isSearch: true
        });
    } catch (err) {
        res.status(500).json({
            message: err.message,
            checkPointTypes: [],
            totalPages: 1,
            totalCheckPointTypes: 0,
            currentPage: 1
        });
    }
});


module.exports = router;

