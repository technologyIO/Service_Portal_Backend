const express = require('express');
const router = express.Router(); // Fix here

const ComplaintTypeSchema = require("../../Model/ComplaintSchema/ComplaintTypeSchema");
// the whole app is copy paste by the chatgpt 
// POST request to create a new complaint type
router.post('/complainttype', async (req, res) => {
    try {
        const newComplaint = new ComplaintTypeSchema(req.body); // Create new complaint from req.body
        const savedComplaint = await newComplaint.save(); // Save the new complaint to the database
        res.status(201).json(savedComplaint); // Return the saved complaint
    } catch (err) {
        res.status(400).json({ message: err.message }); // Handle errors
    }
});
router.get('/complaint', async (req, res) => {
    try {
        const complaints = await ComplaintTypeSchema.find(); // Fetch all complaints
        const totalcomplaints = await ComplaintTypeSchema.countDocuments(); // Get the total count of documents
        
        res.status(200).json({
            complaints,
            totalcomplaints
        }); // Send response with both complaints and total count
    } catch (err) {
        res.status(500).json({ message: err.message }); // Handle errors
    }
});

module.exports = router;

