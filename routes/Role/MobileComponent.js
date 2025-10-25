const express = require('express');
const router = express.Router();
const Component = require('../../Model/Role/mobilecomponentSchema');  

// Create a new component
router.post('/', async (req, res) => {
  try {
    const { componentId, name, isActive } = req.body;
    // validation
    if (!componentId || !name) {
      return res.status(400).json({ message: 'componentId and name are required.' });
    }

    // Check duplicate componentId
    const exists = await Component.findOne({ componentId });
    if (exists) {
      return res.status(409).json({ message: 'Component with this componentId already exists.' });
    }

    const component = new Component({ componentId, name, isActive });
    await component.save();
    res.status(201).json(component);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all components
router.get('/', async (req, res) => {
  try {
    const components = await Component.find();
    res.json(components);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single component by ID (MongoDB _id)
router.get('/:id', async (req, res) => {
  try {
    const component = await Component.findById(req.params.id);
    if (!component) {
      return res.status(404).json({ message: 'Component not found' });
    }
    res.json(component);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update component by ID
router.put('/:id', async (req, res) => {
  try {
    const { componentId, name, isActive } = req.body;

    // If componentId is updated, check for duplicate
    if (componentId) {
      const existing = await Component.findOne({ componentId, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(409).json({ message: 'Another component with this componentId already exists.' });
      }
    }

    const updatedComponent = await Component.findByIdAndUpdate(
      req.params.id,
      { componentId, name, isActive },
      { new: true, runValidators: true }
    );

    if (!updatedComponent) {
      return res.status(404).json({ message: 'Component not found' });
    }

    res.json(updatedComponent);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete component by ID
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Component.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Component not found' });
    }
    res.json({ message: 'Component deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;