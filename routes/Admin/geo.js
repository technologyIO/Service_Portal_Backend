
const express = require('express');
const router = express.Router();
const Geo = require('../../Model/AdminSchema/GeoSchema');



router.get('/api/geo', async (req, res) => {
    try {
        const geoData = await Geo.find();
        res.status(200).json({
            status: 200,
            data: {
                geoDropdown: geoData
            }
        });
    } catch (err) {
        res.status(500).json({
            status: 500,
            message: 'Server error',
            error: err.message
        });
    }
});
router.get('/api/pagegeo', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const GeoEntries = await Geo.find().skip(skip).limit(limit);
        const totalGeoEntries = await Geo.countDocuments();
        const totalPages = Math.ceil(totalGeoEntries / limit);

        res.json({
            GeoEntries,
            totalPages,
            totalGeoEntries
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// Add new geo entry
router.post('/api/geo', async (req, res) => {
    try {
        const { geoName } = req.body;

        if (!geoName) {
            return res.status(400).json({
                status: 400,
                message: 'geoName is required'
            });
        }

        const newGeo = await Geo.create({ geoName });

        res.status(201).json({
            status: 201,
            data: {
                geoDropdown: [newGeo]
            }
        });
    } catch (err) {
        res.status(400).json({
            status: 400,
            message: 'Error creating geo entry',
            error: err.message
        });
    }
});
// Update geo entry
router.put('/api/geo/:id', async (req, res) => {
    try {
        const { geoName, status } = req.body;

        if (!geoName) {
            return res.status(400).json({
                status: 400,
                message: 'geoName is required'
            });
        }

        const updateFields = {
            geoName,
        };

        // Only update status if it's provided
        if (status) {
            updateFields.status = status;
        }

        const updatedGeo = await Geo.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true }
        );

        if (!updatedGeo) {
            return res.status(404).json({
                status: 404,
                message: 'Geo entry not found'
            });
        }

        res.status(200).json({
            status: 200,
            message: 'Geo entry updated successfully',
            data: {
                geoDropdown: [updatedGeo]
            }
        });
    } catch (err) {
        res.status(500).json({
            status: 500,
            message: 'Server error',
            error: err.message
        });
    }
});

// Search geo entries by geoName
router.get('/api/searchgeo', async (req, res) => {
    try {
        const keyword = req.query.keyword;

        if (!keyword) {
            return res.status(400).json({
                status: 400,
                message: 'Search keyword is required'
            });
        }

        const geoResults = await Geo.find({
            geoName: { $regex: keyword, $options: 'i' }
        });

        res.status(200).json({
            status: 200,
            data: {
                geoDropdown: geoResults
            }
        });
    } catch (err) {
        res.status(500).json({
            status: 500,
            message: 'Server error',
            error: err.message
        });
    }
});


// Delete geo entry
router.delete('/api/geo/:id', async (req, res) => {
    try {
        const deletedGeo = await Geo.findByIdAndDelete(req.params.id);

        if (!deletedGeo) {
            return res.status(404).json({
                status: 404,
                message: 'Geo entry not found'
            });
        }

        res.status(200).json({
            status: 200,
            message: 'Geo entry deleted successfully',
            data: {
                geoDropdown: [deletedGeo]
            }
        });
    } catch (err) {
        res.status(500).json({
            status: 500,
            message: 'Server error',
            error: err.message
        });
    }
});

module.exports = router;