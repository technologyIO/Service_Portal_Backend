
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

        return res.status(201).json({
            status: 201,
            data: {
                geoDropdown: [newGeo]
            }
        });
    } catch (err) {
        if (err.code === 11000) {
            // Duplicate key error
            return res.status(409).json({
                status: 409,
                message: 'geoName already exists'
            });
        }

        return res.status(500).json({
            status: 500,
            message: 'Error creating geo entry',
            error: err.message
        });
    }
});

// Update geo entry
router.put('/api/geo/:id', async (req, res) => {
    try {
        const { geoName, status } = req.body;

        // If only status is being updated, fetch existing geoName
        let updateFields = {};

        if (status && !geoName) {
            // Status-only update - fetch existing record
            const existingGeo = await Geo.findById(req.params.id);
            if (!existingGeo) {
                return res.status(404).json({
                    status: 404,
                    message: 'Geo entry not found'
                });
            }
            updateFields = {
                geoName: existingGeo.geoName, // Keep existing geoName
                status
            };
        } else {
            // Full update
            if (!geoName) {
                return res.status(400).json({
                    status: 400,
                    message: 'geoName is required'
                });
            }
            updateFields = { geoName };
            if (status) updateFields.status = status;
        }

        const updatedGeo = await Geo.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true, runValidators: true }
        );

        if (!updatedGeo) {
            return res.status(404).json({
                status: 404,
                message: 'Geo entry not found'
            });
        }

        return res.status(200).json({
            status: 200,
            message: 'Geo entry updated successfully',
            data: {
                geoDropdown: [updatedGeo]
            }
        });
    } catch (err) {
        // Check for duplicate geoName error
        if (err.code === 11000) {
            return res.status(409).json({
                status: 409,
                message: 'geoName already exists'
            });
        }

        return res.status(500).json({
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        if (!keyword) {
            return res.status(400).json({
                status: 400,
                message: 'Search keyword is required'
            });
        }

        const query = {
            $or: [
                { geoName: { $regex: keyword, $options: 'i' } },
                { status: { $regex: keyword, $options: 'i' } }
            ]
        };

        const geoResults = await Geo.find(query).skip(skip).limit(limit);
        const totalGeoEntries = await Geo.countDocuments(query);
        const totalPages = Math.ceil(totalGeoEntries / limit);

        res.status(200).json({
            status: 200,
            data: {
                GeoEntries: geoResults,
                totalPages,
                totalGeoEntries,
                currentPage: page,
                isSearch: true
            }
        });
    } catch (err) {
        res.status(500).json({
            status: 500,
            message: 'Server error',
            error: err.message,
            data: {
                GeoEntries: [],
                totalPages: 1,
                totalGeoEntries: 0,
                currentPage: 1
            }
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