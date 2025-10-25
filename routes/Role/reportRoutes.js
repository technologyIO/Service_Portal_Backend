
const express = require('express');
const router = express.Router();
const Report = require('../../Model/Role/reportSchema');  

// Create a new component
router.post('/reports', async (req, res) => {
  try {
    const { reportId, name, isActive } = req.body;
    // validation
    if (!reportId || !name) {
      return res.status(400).json({ message: 'reportId and name are required.' });
    }

    // Check duplicate reportId
    const exists = await Report.findOne({ reportId });
    if (exists) {
      return res.status(409).json({ message: 'Report with this reportId already exists.' });
    }

    const component = new Report({ reportId, name, isActive });
    await component.save();
    res.status(201).json(component);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all components
router.get('/reports', async (req, res) => {
  try {
    const components = await Report.find();
    res.json(components);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single component by ID (MongoDB _id)
router.get('/reports/:id', async (req, res) => {
  try {
    const component = await Report.findById(req.params.id);
    if (!component) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json(component);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update component by ID
router.put('/reports/:id', async (req, res) => {
  try {
    const { reportId, name, isActive } = req.body;

    // If reportId is updated, check for duplicate
    if (reportId) {
      const existing = await Report.findOne({ reportId, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(409).json({ message: 'Another component with this reportId already exists.' });
      }
    }

    const updatedComponent = await Report.findByIdAndUpdate(
      req.params.id,
      { reportId, name, isActive },
      { new: true, runValidators: true }
    );

    if (!updatedComponent) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json(updatedComponent);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete component by ID
router.delete('/reports/:id', async (req, res) => {
  try {
    const deleted = await Report.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
