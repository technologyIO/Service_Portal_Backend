const express = require('express');
const router = express.Router();
const Dealer = require('../../Model/MasterSchema/DealerSchema');

// Middleware to get dealer by ID
async function getDealerById(req, res, next) {
    let dealer;
    try {
        dealer = await Dealer.findById(req.params.id);
        if (!dealer) {
            return res.status(404).json({ message: 'Dealer not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.dealer = dealer;
    next();
}

// Middleware to check for duplicate email
async function checkDuplicateEmail(req, res, next) {
    let dealer;
    try {
        dealer = await Dealer.findOne({ email: req.body.email });
        if (dealer && dealer._id != req.params.id) {
            return res.status(400).json({ message: 'Email already exists' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}

// GET all dealers
router.get('/dealer', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const dealers = await Dealer.find().skip(skip).limit(limit);
        const totalDealers = await Dealer.countDocuments();
        const totalPages = Math.ceil(totalDealers / limit);

        res.json({
            dealers,
            totalPages,
            totalDealers
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET a dealer by ID
router.get('/dealer/:id', getDealerById, (req, res) => {
    res.json(res.dealer);
});

// CREATE a new dealer
router.post('/dealer', checkDuplicateEmail, async (req, res) => {
    const dealer = new Dealer({
        name: req.body.name,
        personresponsible: req.body.personresponsible,
        email: req.body.email,
        mobilenumber: req.body.mobilenumber,
        status: req.body.status,
        branch: req.body.branch,
        loginexpirydate: req.body.loginexpirydate,
        dealerid: req.body.dealerid,
        country: req.body.country,
        state: req.body.state,
        region: req.body.region,
        city: req.body.city,
        department: req.body.department,
        pincode: req.body.pincode,
        password: req.body.password,
        manageremail: req.body.manageremail,
        skills: req.body.skills,
        profileimage: req.body.profileimage,
        deviceid: req.body.deviceid
    });
    try {
        const newDealer = await dealer.save();
        res.status(201).json(newDealer);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a dealer
router.put('/dealer/:id', getDealerById, checkDuplicateEmail, async (req, res) => {
    if (req.body.name != null) {
        res.dealer.name = req.body.name;
    }
    if (req.body.personresponsible != null) {
        res.dealer.personresponsible = req.body.personresponsible;
    }
    if (req.body.email != null) {
        res.dealer.email = req.body.email;
    }
    if (req.body.mobilenumber != null) {
        res.dealer.mobilenumber = req.body.mobilenumber;
    }
    if (req.body.status != null) {
        res.dealer.status = req.body.status;
    }
    if (req.body.branch != null) {
        res.dealer.branch = req.body.branch;
    }
    if (req.body.loginexpirydate != null) {
        res.dealer.loginexpirydate = req.body.loginexpirydate;
    }
    if (req.body.dealerid != null) {
        res.dealer.dealerid = req.body.dealerid;
    }
    if (req.body.country != null) {
        res.dealer.country = req.body.country;
    }
    if (req.body.state != null) {
        res.dealer.state = req.body.state;
    }
    if (req.body.region != null) {
        res.dealer.region = req.body.region;
    }
    if (req.body.city != null) {
        res.dealer.city = req.body.city;
    }
    if (req.body.department != null) {
        res.dealer.department = req.body.department;
    }
    if (req.body.pincode != null) {
        res.dealer.pincode = req.body.pincode;
    }
    if (req.body.password != null) {
        res.dealer.password = req.body.password;
    }
    if (req.body.manageremail != null) {
        res.dealer.manageremail = req.body.manageremail;
    }
    if (req.body.skills != null) {
        res.dealer.skills = req.body.skills;
    }
    if (req.body.profileimage != null) {
        res.dealer.profileimage = req.body.profileimage;
    }
    if (req.body.deviceid != null) {
        res.dealer.deviceid = req.body.deviceid;
    }

    try {
        const updatedDealer = await res.dealer.save();
        res.json(updatedDealer);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a dealer
router.delete('/dealer/:id', async (req, res) => {
    try {
        const deletDealer = await Dealer.deleteOne({ _id: req.params.id })
        if (deletDealer.deletedCount === 0) {
            res.status(404).json({ message: "Dealer Not Found" })
        }
        res.json({ message: 'Deleted Dealer' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
