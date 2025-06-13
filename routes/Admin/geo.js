
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