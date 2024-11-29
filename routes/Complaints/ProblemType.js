const express = require('express');
const ProblemTypeSchema = require('../../Model/ComplaintSchema/ProblemTypeSchema');
const router = express.Router();

// Import the ProblemType model

// POST request to create a new problem type
router.post('/problemtype', async (req, res) => {
    try {
        const newProblemType = new ProblemTypeSchema(req.body); // Use the imported model
        const savedProblemType = await newProblemType.save(); // Save the new problem type

        res.status(201).json(savedProblemType); // Respond with the saved problem type
    } catch (err) {
        res.status(400).json({ message: err.message }); // Handle any errors
    }
});


router.get('/problemtype', async (req, res) => {
    try {
        const problemtype = await ProblemTypeSchema.find()
        const totalproblemtype = await ProblemTypeSchema.countDocuments()
        res.status(200).json({
            problemtype,
            totalproblemtype
        });
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

module.exports = router;
