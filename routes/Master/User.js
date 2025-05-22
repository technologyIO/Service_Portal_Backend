// Routes: userRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../../Model/MasterSchema/UserSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Middleware to get user by ID
async function getUserById(req, res, next) {
    let user;
    try {
        user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.user = user;
    next();
}
// Middleware to get user by email
async function getUserForLogin(req, res, next) {
    let user;


    try {

        if (req.body.employeeid) {
            user = await User.findOne({ employeeid: req.body.employeeid });
        } else if (req.body.email) {
            user = await User.findOne({ email: req.body.email });
        }

        if (!user) return res.status(404).json({ message: 'User Not found' });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.user = user;
    next();
}



// Middleware to get user by employeeid
async function getUserByEmployeeId(req, res, next) {
    let user;
    try {
        user = await User.findOne({ employeeid: req.body.employeeid });
        if (!user) return res.status(404).json({ message: 'User not found' });
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

// GET all users with pagination
router.get('/user', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const users = await User.find().skip(skip).limit(limit);
        const totalUsers = await User.countDocuments();
        const totalPages = Math.ceil(totalUsers / limit);
        res.json({ users, totalPages, totalUsers });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET a user by ID
router.get('/user/:id', getUserById, (req, res) => {
    res.json(res.user);
});

// GET all users without pagination
router.get('/alluser', async (req, res) => {
    try {
        const user = await User.find();
        console.log("Fetched user:", user);
        res.json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// CREATE a new user
router.post('/user', checkDuplicateEmail, async (req, res) => {
    try {
        const {
            firstname,
            lastname,
            email,
            mobilenumber,
            status,
            branch,
            loginexpirydate,
            employeeid,
            country,
            state,
            city,
            department,
            password,
            manageremail,
            skills,
            profileimage,
            deviceid,
            usertype,
            location,
            roleName,
            roleId,
            dealerName,
            dealerId
        } = req.body;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userData = {
            firstname,
            lastname,
            email,
            mobilenumber,
            status,
            branch,
            loginexpirydate,
            employeeid,
            country,
            state,
            city,
            department,
            password: hashedPassword,
            manageremail,
            skills,
            profileimage,
            deviceid,
            usertype,
            location,
            deviceregistereddate: new Date(),
            modifiedAt: new Date()
        };

        if (usertype === 'skanray') {
            userData.role = {
                roleName,
                roleId
            };
        } else if (usertype === 'dealer') {
            userData.dealerInfo = {
                dealerName,
                dealerId
            };
        }

        const newUser = new User(userData);
        const savedUser = await newUser.save();
        res.status(201).json(savedUser);
    } catch (err) {
        console.error("Error creating user:", err);
        res.status(400).json({ message: err.message });
    }
});

// LOGIN route
router.post('/login', getUserForLogin, async (req, res) => {


    try {
        const isMatch = await bcrypt.compare(req.body.password, res.user.password);
        console.log("ismatch", isMatch)
        if (!isMatch) return res.status(400).json({ message: 'Invalid password' });

        const token = jwt.sign(
            { id: res.user._id, email: res.user.email },
            "myservice-secret"
        );

        res.json({
            token,
            user: {
                id: res.user._id,
                firstname: res.user.firstname,
                lastname: res.user.lastname,
                email: res.user.email,
                mobilenumber: res.user.mobilenumber,
                status: res.user.status,
                branch: res.user.branch,
                loginexpirydate: res.user.loginexpirydate,
                employeeid: res.user.employeeid,
                country: res.user.country,
                state: res.user.state,
                city: res.user.city,
                department: res.user.department,
                skills: res.user.skills,
                profileimage: res.user.profileimage,
                deviceid: res.user.deviceid,
                usertype: res.user.usertype,
                role: res.user.role,
                dealerInfo: res.user.dealerInfo,
                location: res.user.location
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



// UPDATE a user
router.put('/user/:id', getUserById, checkDuplicateEmail, async (req, res) => {
    if (req.body.firstname != null) res.user.firstname = req.body.firstname;
    if (req.body.lastname != null) res.user.lastname = req.body.lastname;
    if (req.body.email != null) res.user.email = req.body.email;
    if (req.body.mobilenumber != null) res.user.mobilenumber = req.body.mobilenumber;
    if (req.body.status != null) res.user.status = req.body.status;
    if (req.body.branch != null) res.user.branch = req.body.branch; // expect an array
    if (req.body.loginexpirydate != null) res.user.loginexpirydate = req.body.loginexpirydate;
    if (req.body.employeeid != null) res.user.employeeid = req.body.employeeid;
    if (req.body.country != null) res.user.country = req.body.country;
    if (req.body.state != null) res.user.state = req.body.state;
    if (req.body.city != null) res.user.city = req.body.city;
    if (req.body.department != null) res.user.department = req.body.department;
    if (req.body.manageremail != null) res.user.manageremail = req.body.manageremail;
    if (req.body.skills != null) res.user.skills = req.body.skills;
    if (req.body.profileimage != null) res.user.profileimage = req.body.profileimage;
    if (req.body.deviceid != null) res.user.deviceid = req.body.deviceid;
    if (req.body.usertype != null) res.user.usertype = req.body.usertype;
    if (req.body.roleName != null) {
        res.user.role = {
            roleName: req.body.roleName,
            roleId: req.body.roleId
        };
    }
    if (req.body.dealerName != null) {
        res.user.dealerInfo = {
            dealerName: req.body.dealerName,
            dealerId: req.body.dealerId
        };
    }
    if (req.body.location != null) res.user.location = req.body.location; // expect an array

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
        const userDeleted = await User.deleteOne({ _id: req.params.id });
        if (userDeleted.deletedCount === 0) {
            return res.status(404).json({ message: "User Not Found" });
        }
        res.json({ message: 'Deleted User' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// SEARCH route
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ message: 'Query parameter is required' });

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
                { skills: { $regex: q, $options: 'i' } },
                { usertype: { $regex: q, $options: 'i' } }
            ]
        };

        const users = await User.find(query);
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
