const express = require('express');
const router = express.Router();
const Region = require('../../Model/AdminSchema/RegionSchema');

// Get all regions
router.get('/api/region', async (req, res) => {
    try {
        const regions = await Region.find();
        res.status(200).json({
            status: 200,
            data: {
                regionDropdown: regions
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

// Get single region by ID
router.get('/api/region/:id', async (req, res) => {
    try {
        const region = await Region.findById(req.params.id);
        
        if (!region) {
            return res.status(404).json({
                status: 404,
                message: 'Region not found'
            });
        }

        res.status(200).json({
            status: 200,
            data: {
                region: region
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

// Create new region
router.post('/api/region', async (req, res) => {
    try {
        const { regionName, states } = req.body;

        if (!regionName) {
            return res.status(400).json({
                status: 400,
                message: 'regionName is required'
            });
        }

        // Check if region already exists (due to unique constraint)
        const existingRegion = await Region.findOne({ regionName });
        if (existingRegion) {
            return res.status(409).json({
                status: 409,
                message: 'Region with this name already exists'
            });
        }

        const newRegion = await Region.create({ 
            regionName, 
            states: states || []
        });

        res.status(201).json({
            status: 201,
            message: 'Region created successfully',
            data: {
                region: newRegion
            }
        });
    } catch (err) {
        res.status(400).json({
            status: 400,
            message: 'Error creating region',
            error: err.message
        });
    }
});

// Update region
router.put('/api/region/:id', async (req, res) => {
    try {
        const { regionName, states } = req.body;

        if (!regionName) {
            return res.status(400).json({
                status: 400,
                message: 'regionName is required'
            });
        }

        // Check if another region with the same name exists (excluding current one)
        const existingRegion = await Region.findOne({ 
            regionName, 
            _id: { $ne: req.params.id } 
        });
        
        if (existingRegion) {
            return res.status(409).json({
                status: 409,
                message: 'Region with this name already exists'
            });
        }

        const updatedRegion = await Region.findByIdAndUpdate(
            req.params.id,
            { 
                regionName, 
                states: states || []
            },
            { new: true, runValidators: true }
        );

        if (!updatedRegion) {
            return res.status(404).json({
                status: 404,
                message: 'Region not found'
            });
        }

        res.status(200).json({
            status: 200,
            message: 'Region updated successfully',
            data: {
                region: updatedRegion
            }
        });
    } catch (err) {
        res.status(400).json({
            status: 400,
            message: 'Error updating region',
            error: err.message
        });
    }
});

// Delete region
router.delete('/api/region/:id', async (req, res) => {
    try {
        const deletedRegion = await Region.findByIdAndDelete(req.params.id);

        if (!deletedRegion) {
            return res.status(404).json({
                status: 404,
                message: 'Region not found'
            });
        }

        res.status(200).json({
            status: 200,
            message: 'Region deleted successfully',
            data: {
                region: deletedRegion
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