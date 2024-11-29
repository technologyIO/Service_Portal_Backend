const express = require('express');
const ProblemName = require('../../Model/ComplaintSchema/ProblemName');

const router = express.Router();


router.post('/problemname', async (req, res) => {
    try {
        const newProblemName = await ProblemName(req.body)
        const savedProblemName = await newProblemName.save()

        res.status(201).json(savedProblemName)

    } catch (err) {
        res.status(400).json({ message: err.message })

    }
})

router.get('/problemname', async (req, res) => {
    try {
        const problemname = await ProblemName.find();
        const totalproblemsname = await ProblemName.countDocuments()
        res.status(200).json({
            problemname, totalproblemsname

        })
    } catch (err) {
        res.status(500).json({ message: err.message })

    }
})


module.exports = router;