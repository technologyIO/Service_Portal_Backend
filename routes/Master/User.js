const express = require('express');
const router = express.Router();
const User = require('../../Model/MasterSchema/UserSchema');

// Middleware to get user by ID
async function getUserById(req, res, next) {
    let user;
    try {
        user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.user = user;
    next();
}

// Middleware to check for duplicate email
async function checkDuplicateEmail(req, res, next) {
    let user;
    try {
        user = await User.findOne({ email: req.body.email });
        if (user && user._id != req.params.id) {
            return res.status(400).json({ message: 'Email already exists' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}

// GET all users
router.get('/user', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const users = await User.find().skip(skip).limit(limit);
        const totalUsers = await User.countDocuments();
        const totalPages = Math.ceil(totalUsers / limit);

        res.json({
            users,
            totalPages,
            totalUsers
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET a user by ID
router.get('/user/:id', getUserById, (req, res) => {
    res.json(res.user);
});

// CREATE a new user
router.post('/user', checkDuplicateEmail, async (req, res) => {
    const user = new User({
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: req.body.email,
        mobilenumber: req.body.mobilenumber,
        status: req.body.status,
        branch: req.body.branch,
        loginexpirydate: req.body.loginexpirydate,
        employeeid: req.body.employeeid,
        country: req.body.country,
        state: req.body.state,
        city: req.body.city,
        department: req.body.department,
        password: req.body.password,
        manageremail: req.body.manageremail,
        skills: req.body.skills,
        profileimage: req.body.profileimage,
        deviceid: req.body.deviceid
    });
    try {
        const newUser = await user.save();
        res.status(201).json(newUser);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a user
router.put('/user/:id', getUserById, checkDuplicateEmail, async (req, res) => {
    if (req.body.firstname != null) {
        res.user.firstname = req.body.firstname;
    }
    if (req.body.lastname != null) {
        res.user.lastname = req.body.lastname;
    }
    if (req.body.email != null) {
        res.user.email = req.body.email;
    }
    if (req.body.mobilenumber != null) {
        res.user.mobilenumber = req.body.mobilenumber;
    }
    if (req.body.status != null) {
        res.user.status = req.body.status;
    }
    if (req.body.branch != null) {
        res.user.branch = req.body.branch;
    }
    if (req.body.loginexpirydate != null) {
        res.user.loginexpirydate = req.body.loginexpirydate;
    }
    if (req.body.employeeid != null) {
        res.user.employeeid = req.body.employeeid;
    }
    if (req.body.country != null) {
        res.user.country = req.body.country;
    }
    if (req.body.state != null) {
        res.user.state = req.body.state;
    }
    if (req.body.city != null) {
        res.user.city = req.body.city;
    }
    if (req.body.department != null) {
        res.user.department = req.body.department;
    }
    if (req.body.password != null) {
        res.user.password = req.body.password;
    }
    if (req.body.manageremail != null) {
        res.user.manageremail = req.body.manageremail;
    }
    if (req.body.skills != null) {
        res.user.skills = req.body.skills;
    }
    if (req.body.profileimage != null) {
        res.user.profileimage = req.body.profileimage;
    }
    if (req.body.deviceid != null) {
        res.user.deviceid = req.body.deviceid;
    }

    try {
        const updatedUser = await res.user.save();
        res.json(updatedUser);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a user
router.delete('/user/:id', async (req, res) => {
    try {
        const userDeleted = await User.deleteOne({ _id: req.params.id })
        if (userDeleted.deletedCount === 0) {
            res.status(404).json({ message: "User Not Found" })
        }
        res.json({ message: 'Deleted User' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const query = {
            $or: [
                { firstname: { $regex: q, $options: 'i' } },
                { lastname: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { mobilenumber: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } },
                { branch: { $regex: q, $options: 'i' } },
                { country: { $regex: q, $options: 'i' } },
                { state: { $regex: q, $options: 'i' } },
                { city: { $regex: q, $options: 'i' } },
                { department: { $regex: q, $options: 'i' } },
                { manageremail: { $regex: q, $options: 'i' } },
                { skills: { $regex: q, $options: 'i' } }
            ]
        };

        const users = await User.find(query);

        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
