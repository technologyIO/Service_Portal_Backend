const express = require('express')
const router = express.Router();
const Branch = require("../../Model/CollectionSchema/BranchSchema")


async function getBranch(req, res, next) {
    try {
        const branch = await Branch.findById(req.params.id)
        if (!branch) {
            return res.status(404).json({ message: 'Branch not found' })
        }
        res.branch = branch;
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message })
    }
}

async function checkDuplicateBranch(req, res, next) {
    const { name, city, state } = req.body;
    try {
        const existingBranch = await Branch.findOne({ name, city, state });
        if (existingBranch) {
            return res.status(400).json({ message: 'Branch Already Exist' })
        }
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}


router.post('/branch', checkDuplicateBranch, async (req, res) => {
    try {
        const newBranch = new Branch(req.body);
        const savedBranch = await newBranch.save();
        res.status(201).json(savedBranch);
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
})


router.get('/branch', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Current page number, defaulting to 1
        const limit = parseInt(req.query.limit) || 10; // Number of documents per page, defaulting to 10

        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        const branches = await Branch.find().skip(skip).limit(limit); // Fetch branches for the current page
        const totalBranches = await Branch.countDocuments(); // Total number of branches

        const totalPages = Math.ceil(totalBranches / limit); // Calculate total number of pages

        res.json({
            branches,
            totalPages,
            totalBranches
        });
    } catch (err) {
        res.status(500).json({ message: err.message }); // Handle error and return JSON response with status 500 (Internal Server Error)
    }
});


router.get('/branch/:id', getBranch, (req, res) => {
    res.json(res.branch); // Return single branch fetched by middleware
});

router.patch('/branch/:id', getBranch, async (req, res) => {
    const { name, status, city, branchShortCode, state } = req.body;

    // Update branch fields if they are provided
    if (name != null) {
        res.branch.name = name;
    }
    if (status != null) {
        res.branch.status = status;
    }
    if (city != null) {
        res.branch.city = city;
    }
    if (branchShortCode != null) {
        res.branch.branchShortCode = branchShortCode;
    }
    if (state != null) {
        res.branch.state = state;
    }

    res.branch.modifiedAt = Date.now();

    try {
        const updatedBranch = await res.branch.save();
        res.json(updatedBranch);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});


router.delete('/branch/:id', async (req, res) => {
    try {
        const deletedBranch = await Branch.deleteOne({ _id: req.params.id });
        if (deletedBranch.deletedCount === 0) {
            return res.status(404).json({ message: 'Branch Not Found' })
        }
        res.json({ message: "Branch Deleted" })
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})



module.exports = router;