const express = require('express');
const router = express.Router();
const EquipmentChecklist = require('../../Model/CollectionSchema/EquipmentChecklistSchema'); // Adjust the path as needed

// Create a new checklist
router.post('/checklists', async (req, res) => {
  try {
    const { serialNumber, checklistResults, globalRemark } = req.body;
    const newChecklist = new EquipmentChecklist({
      serialNumber,
      checklistResults,
      globalRemark
    });
    const savedChecklist = await newChecklist.save();
    res.status(201).json(savedChecklist);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all checklists
router.get('/checklists', async (req, res) => {
  try {
    const checklists = await EquipmentChecklist.find();
    res.json(checklists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a checklist by ID
router.get('/checklists/:id', async (req, res) => {
  try {
    const checklist = await EquipmentChecklist.findById(req.params.id);
    if (!checklist) return res.status(404).json({ message: 'Checklist not found' });
    res.json(checklist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a checklist by ID
router.put('/checklists/:id', async (req, res) => {
  try {
    const { serialNumber, checklistResults, globalRemark } = req.body;
    const checklist = await EquipmentChecklist.findById(req.params.id);
    if (!checklist) return res.status(404).json({ message: 'Checklist not found' });

    if (serialNumber) checklist.serialNumber = serialNumber;
    if (checklistResults) checklist.checklistResults = checklistResults;
    if (globalRemark !== undefined) checklist.globalRemark = globalRemark;

    const updatedChecklist = await checklist.save();
    res.json(updatedChecklist);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a checklist by ID
router.delete('/checklists/:id', async (req, res) => {
  try {
    const checklist = await EquipmentChecklist.findByIdAndDelete(req.params.id);
    if (!checklist) return res.status(404).json({ message: 'Checklist not found' });
    res.json({ message: 'Checklist deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
