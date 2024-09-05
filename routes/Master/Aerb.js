const express = require('express');
const router = express.Router();
const Aerb = require('../../Model/MasterSchema/AerbSchema');

// Middleware to get an Aerb entry by ID
async function getAerbById(req, res, next) {
    let aerb;
    try {
        aerb = await Aerb.findById(req.params.id);
        if (!aerb) {
            return res.status(404).json({ message: 'Aerb entry not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.aerb = aerb;
    next();
}

// Middleware to check for duplicate material code
async function checkDuplicateAerb(req, res, next) {
    let aerb;
    try {
        aerb = await Aerb.findOne({
            materialcode: req.body.materialcode
        });
        if (aerb && aerb._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate material code found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}

// GET all Aerb entries
router.get('/aerb', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const aerbEntries = await Aerb.find().skip(skip).limit(limit);
        const totalAerbEntries = await Aerb.countDocuments();
        const totalPages = Math.ceil(totalAerbEntries / limit);

        res.json({
            aerbEntries,
            totalPages,
            totalAerbEntries
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// GET Aerb entry by ID
router.get('/aerb/:id', getAerbById, (req, res) => {
    res.json(res.aerb);
});

// CREATE a new Aerb entry
router.post('/aerb', checkDuplicateAerb, async (req, res) => {
    const aerb = new Aerb({
        materialcode: req.body.materialcode,
        materialdescription: req.body.materialdescription,
        status: req.body.status
    });
    try {
        const newAerb = await aerb.save();
        res.status(201).json(newAerb);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE an Aerb entry
router.put('/aerb/:id', getAerbById, checkDuplicateAerb, async (req, res) => {
    if (req.body.materialcode != null) {
        res.aerb.materialcode = req.body.materialcode;
    }
    if (req.body.materialdescription != null) {
        res.aerb.materialdescription = req.body.materialdescription;
    }
    if (req.body.status != null) {
        res.aerb.status = req.body.status;
    }
    try {
        const updatedAerb = await res.aerb.save();
        res.json(updatedAerb);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE an Aerb entry
router.delete('/aerb/:id', async (req, res) => {
    try {
       const deleteAerb = await Aerb.deleteOne({_id:req.params.id})
       if(deleteAerb.deletedCount === 0){
        res.status(404).json({message:"AERB Not Found"})
       }
        res.json({ message: 'Deleted Aerb entry' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
