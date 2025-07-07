const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const City = require("../../Model/CollectionSchema/CitySchema");

// Middleware: Get City by ID
async function getCity(req, res, next) {
    try {
        const city = await City.findById(req.params.id);
        if (!city) {
            return res.status(404).json({ message: 'City Not Found' });
        }
        res.city = city;
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// Middleware: Check Duplicate City
// async function checkDuplicateCity(req, res, next) {
//     const { name, branch, cityID } = req.body;
//     try {
//         const existingCity = await City.findOne({ $or: [{ name, branch }, { cityID }] });
//         if (existingCity) {
//             return res.status(400).json({ message: 'City with the same name/branch or cityID already exists' });
//         }
//         next();
//     } catch (err) {
//         return res.status(500).json({ message: err.message });
//     }
// }

// Create City
router.post('/city', async (req, res) => {
    try {
        const newCity = new City(req.body);
        const savedCity = await newCity.save();
        res.status(201).json(savedCity);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get All Cities with Pagination
router.get('/city', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;
        const city = await City.find().skip(skip).limit(limit);
        const totalcity = await City.countDocuments();
        const totalpages = Math.ceil(totalcity / limit);
        res.json(
            {
                city,
                totalpages,
                totalcity
            }
        ); // Return all branchs
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



// Get City by ID
router.get('/city/:id', getCity, (req, res) => {
    res.json(res.city);
});

router.get('/allcity', async (req, res) => {
    try {
        const city = await City.find(); // Fetch all countries
        res.json(city); // Return all countries as JSON
    } catch (err) {
        res.status(500).json({ message: err.message }); // Handle error and return JSON response
    }
});


// Update City
router.patch('/city/:id', getCity, async (req, res) => {
    const { name, status, branch, cityID } = req.body;
    if (name != null) res.city.name = name;
    if (status != null) res.city.status = status;
    if (branch != null) res.city.branch = branch;
    if (cityID != null) res.city.cityID = cityID;

    res.city.modifiedAt = Date.now();

    try {
        const updatedCity = await res.city.save();
        res.json(updatedCity);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete City
router.delete('/city/:id', async (req, res) => {
    try {
        const deletedCity = await City.deleteOne({ _id: req.params.id });
        if (deletedCity.deletedCount === 0) {
            return res.status(404).json({ message: 'City not found' });
        }
        res.json({ message: 'Deleted City' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Search City
router.get('/searchCity', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const query = {
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } },
                { branch: { $regex: q, $options: 'i' } },
                { cityID: { $regex: q, $options: 'i' } }
            ]
        };

        const cities = await City.find(query);
        res.json(cities);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
