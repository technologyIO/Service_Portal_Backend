const express = require('express');
const Overlay = require('../../Model/overlays');
const router = express.Router();

// Create a new overlay
router.post('/', async (req, res) => {
    console.log(req.body);  // Log the request body to see if imageBase64 is being sent
    try {
        const overlay = new Overlay(req.body);
        await overlay.save();
        res.status(201).json(overlay);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get overlays by video URL
router.get('/', async (req, res) => {
    const { videoUrl } = req.query;
    try {
        const overlays = await Overlay.find({ videoUrl: videoUrl });
        res.json(overlays);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update an overlay
router.put('/:id', async (req, res) => {
    try {
        const overlay = await Overlay.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!overlay) {
            return res.status(404).json({ message: 'Overlay not found' });
        }
        res.json(overlay);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete an overlay
router.delete('/:id', async (req, res) => {
    try {
        const overlay = await Overlay.findByIdAndDelete(req.params.id);
        if (!overlay) {
            return res.status(404).json({ message: 'Overlay not found' });
        }
        res.json({ message: 'Overlay deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
