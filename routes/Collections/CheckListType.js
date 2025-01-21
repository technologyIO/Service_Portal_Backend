const express = require('express');
const router = express.Router();
const CheckListType = require('../../Model/CollectionSchema/CheckListTypeSchema');

// Middleware function to get a CheckListType by ID
async function getCountry(req, res, next) {
    try {
        const checkListType = await CheckListType.findById(req.params.id); // Use a different name
        if (!checkListType) {
            return res.status(404).json({ message: 'CheckListType not found' });
        }
        res.CheckListType = checkListType; // Attach CheckListType object to response
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// Create a new CheckListType
router.post('/CheckListType', async (req, res) => {
    try {
        const newCountry = new CheckListType(req.body);
        const savedCountry = await newCountry.save();
        res.status(201).json(savedCountry); // Return newly created CheckListType
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get all countries
router.get('/CheckListType', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Current page number, defaulting to 1
        const limit = parseInt(req.query.limit) || 10; // Number of documents per page, defaulting to 10

        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        const countries = await CheckListType.find().skip(skip).limit(limit); // Fetch countries for the current page
        const totalCountries = await CheckListType.countDocuments(); // Total number of countries

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


// Get a single CheckListType
router.get('/CheckListType/:id', getCountry, (req, res) => {
    res.json(res.CheckListType); // Return single CheckListType fetched by middleware
});
router.get('/allchecklisttype', async (req, res) => {
    try {
        const checklistTypes = await CheckListType.find();
        console.log("Fetched checklist types:", checklistTypes); // Debug log
        res.json(checklistTypes);
    } catch (error) {
        console.error("Error fetching checklist types:", error); // Debug log
        res.status(500).json({ message: 'Server Error' });
    }
});


// Update a CheckListType
router.patch('/CheckListType/:id', getCountry, async (req, res) => {
    if (req.body.name) {
        res.CheckListType.name = req.body.name;
    }
    if (req.body.status) {
        res.CheckListType.status = req.body.status;
    }
    res.CheckListType.modifiedAt = Date.now(); // Update modifiedAt timestamp
    try {
        const updatedCheckListType = await res.CheckListType.save();
        res.json(updatedCheckListType); // Return updated CheckListType
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a CheckListType
router.delete('/CheckListType/:id', async (req, res) => {
    try {
        const deletedCountry = await CheckListType.deleteOne({ _id: req.params.id });
        if (deletedCountry.deletedCount === 0) {
            return res.status(404).json({ message: 'CheckListType not found' });
        }
        res.json({ message: 'Deleted CheckListType' }); // Return success message
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/searchCheckListType', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const query = {
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } },
            ]
        };

        const checkListTypes = await CheckListType.find(query); // Use a different variable name

        res.json(checkListTypes); // Return the result
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


module.exports = router;
