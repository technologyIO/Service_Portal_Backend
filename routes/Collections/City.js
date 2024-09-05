const express = require('express')
const router = express.Router();
const City = require("../../Model/CollectionSchema/CitySchema")

async function getCity(req, res, next) {
    try {
        const city = await City.findById(req.params.id);
        if (!city) {
            return res.status(404).json({ message: 'City Not Found' })
        }
        res.city = city;
        next();

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

async function checkDuplicateCity(req, res, next) {
    const { name, state } = req.body;
    try {
        const existingCity = await City.findOne({ name, state });
        if (existingCity) {
            return res.status(400).json({ message: 'City with the same name and State already exists' });
        }
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}


router.post('/city', checkDuplicateCity, async (req, res) => {
    try {
        const newCity = new City(req.body);
        const savedCity = await newCity.save();
        res.status(201).json(savedCity);
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
})



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
        ); // Return all states
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



router.get('/city/:id', getCity, (req, res) => {
    res.json(res.city)
})


router.patch('/city/:id', getCity, async (req, res) => {
    if (req.body.name != null) {
        res.city.name = req.body.name;
    }
    if (req.body.status != null) {
        res.city.status = req.body.status;
    }
    if (req.body.state != null) {
        res.city.state = req.body.state;
    }
    res.city.modifiedAt = Date.now(); // Update modifiedAt field
    try {
        const updatedCity = await res.city.save();
        res.json(updatedCity);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});


router.delete('/city/:id', async (req, res) => {
    try {
        const deletedCity = await City.deleteOne({ _id: req.params.id });
        if (deletedCity.deletedCount === 0) {
            return res.status(404).json({ message: 'City not found' });
        }
        res.json({ message: 'Deleted City' }); // Return success message
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



module.exports = router;