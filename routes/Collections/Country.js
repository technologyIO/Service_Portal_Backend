const express = require('express');
const router = express.Router();
const Country = require('../../Model/CollectionSchema/CountrySchema');

// Middleware function to get a country by ID
async function getCountry(req, res, next) {
    try {
        const country = await Country.findById(req.params.id);
        if (!country) {
            return res.status(404).json({ message: 'Country not found' });
        }
        res.country = country; // Attach country object to response
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// Create a new country
router.post('/country', async (req, res) => {
    try {
        const newCountry = new Country(req.body);
        const savedCountry = await newCountry.save();
        res.status(201).json(savedCountry); // Return newly created country
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get all countries
router.get('/country', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Current page number, defaulting to 1
        const limit = parseInt(req.query.limit) || 10; // Number of documents per page, defaulting to 10

        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        const countries = await Country.find().skip(skip).limit(limit); // Fetch countries for the current page
        const totalCountries = await Country.countDocuments(); // Total number of countries

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


// Get a single country
router.get('/country/:id', getCountry, (req, res) => {
    res.json(res.country); // Return single country fetched by middleware
});

// Update a country
router.patch('/country/:id', getCountry, async (req, res) => {
    if (req.body.name) {
        res.country.name = req.body.name;
    }
    if (req.body.status) {
        res.country.status = req.body.status;
    }
    res.country.modifiedAt = Date.now(); // Update modifiedAt timestamp
    try {
        const updatedCountry = await res.country.save();
        res.json(updatedCountry); // Return updated country
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a country
router.delete('/country/:id', async (req, res) => {
    try {
        const deletedCountry = await Country.deleteOne({ _id: req.params.id });
        if (deletedCountry.deletedCount === 0) {
            return res.status(404).json({ message: 'Country not found' });
        }
        res.json({ message: 'Deleted Country' }); // Return success message
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
