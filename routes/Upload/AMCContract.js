const express = require('express');
const router = express.Router();
const AMCContract = require('../../Model/UploadSchema/AMCContractSchema');

// Middleware to get an AMCContract by ID
async function getAMCContractById(req, res, next) {
    let amcContract;
    try {
        amcContract = await AMCContract.findById(req.params.id);
        if (!amcContract) {
            return res.status(404).json({ message: 'AMC Contract not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.amcContract = amcContract;
    next();
}

// Middleware to check for duplicate salesdoc
async function checkDuplicateSalesDoc(req, res, next) {
    let amcContract;
    try {
        amcContract = await AMCContract.findOne({
            salesdoc: req.body.salesdoc
        });
        if (amcContract && amcContract._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate salesdoc found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}

router.get('/amccontracts', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const amcContracts = await AMCContract.find().skip(skip).limit(limit);
        const totalAMCContracts = await AMCContract.countDocuments();
        const totalPages = Math.ceil(totalAMCContracts / limit);

        res.json({
            amcContracts,
            totalPages,
            totalAMCContracts
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// GET AMC Contract by ID
router.get('/amccontracts/:id', getAMCContractById, (req, res) => {
    res.json(res.amcContract);
});

// CREATE a new AMC Contract
router.post('/amccontracts', checkDuplicateSalesDoc, async (req, res) => {
    const amcContract = new AMCContract({
        salesdoc: req.body.salesdoc,
        startdate: req.body.startdate,
        enddate: req.body.enddate,
        satypeZDRC_ZDRN: req.body.satypeZDRC_ZDRN,
        serialnumber: req.body.serialnumber,
        materialcode: req.body.materialcode,
        status: req.body.status
    });
    try {
        const newAMCContract = await amcContract.save();
        res.status(201).json(newAMCContract);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE an AMC Contract
router.put('/amccontracts/:id', getAMCContractById, checkDuplicateSalesDoc, async (req, res) => {
    if (req.body.salesdoc != null) {
        res.amcContract.salesdoc = req.body.salesdoc;
    }
    if (req.body.startdate != null) {
        res.amcContract.startdate = req.body.startdate;
    }
    if (req.body.enddate != null) {
        res.amcContract.enddate = req.body.enddate;
    }
    if (req.body.satypeZDRC_ZDRN != null) {
        res.amcContract.satypeZDRC_ZDRN = req.body.satypeZDRC_ZDRN;
    }
    if (req.body.serialnumber != null) {
        res.amcContract.serialnumber = req.body.serialnumber;
    }
    if (req.body.materialcode != null) {
        res.amcContract.materialcode = req.body.materialcode;
    }
    if (req.body.status != null) {
        res.amcContract.status = req.body.status;
    }
    try {
        const updatedAMCContract = await res.amcContract.save();
        res.json(updatedAMCContract);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE an AMC Contract
router.delete('/amccontracts/:id', getAMCContractById, async (req, res) => {
    try {
       const deletedAMCContract = await AMCContract.deleteOne({_id:req.params.id});
       if(deletedAMCContract.deletedCount === 0){
        return res.status(404).json({message:'AMC Contract Not Found'});
       }
        res.json({ message: 'Deleted AMC Contract' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
