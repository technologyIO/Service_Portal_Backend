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
        // Find user by employeeid or email
        if (req.body.employeeid) {
            user = await User.findOne({ employeeid: req.body.employeeid });
        } else if (req.body.email) {
            user = await User.findOne({ email: req.body.email });
        }

        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                errorCode: 'USER_NOT_FOUND'
            });
        }

        // Check if user is deactivated
        if (user.status === 'Deactive') {
            return res.status(403).json({
                message: 'Your account has been deactivated. Please contact administrator.',
                errorCode: 'ACCOUNT_DEACTIVATED',
                userStatus: 'Deactive'
            });
        }
    } catch (err) {
        return res.status(500).json({
            message: err.message,
            errorCode: 'SERVER_ERROR'
        });
    }
    res.user = user;
    next();
}
router.patch('/user/:id/status', getUserById, async (req, res) => {
    try {
        const { status } = req.body;
        const user = res.user;

        // Validate status
        if (!status || !['Active', 'Deactive'].includes(status)) {
            return res.status(400).json({
                message: 'Status is required and must be either "Active" or "Deactive"',
                errorCode: 'INVALID_STATUS'
            });
        }

        // No change needed if status is same
        if (user.status === status) {
            return res.json({
                message: `User is already ${status}`,
                user,
                warningCode: 'STATUS_UNCHANGED'
            });
        }

        // Update status
        user.status = status;
        user.modifiedAt = new Date();

        // If deactivating, clear device info to force logout
        if (status === 'Deactive') {
            user.deviceid = null;
            user.deviceregistereddate = null;

            // You might want to invalidate existing tokens here
            // This would require maintaining a token blacklist
        }

        const updatedUser = await user.save();

        res.json({
            success: true,
            message: `User ${status === 'Active' ? 'reactivated' : 'deactivated'} successfully`,
            user: updatedUser,
            statusChanged: true
        });

    } catch (err) {
        res.status(500).json({
            message: err.message,
            errorCode: 'SERVER_ERROR'
        });
    }
});

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

        const users = await User.find({}, { password: 0 }).skip(skip).limit(limit);
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



router.post('/user', checkDuplicateEmail, async (req, res) => {
    try {
        const {
            firstname,
            lastname,
            email,
            mobilenumber,
            address,
            city,
            state,
            country,
            zipCode,
            loginexpirydate,
            employeeid,
            department,
            password,
            manageremail,
            profileimage,
            deviceid,
            usertype,
            role,
            dealerInfo,
            skills,
            demographics
        } = req.body;

        // Validate required fields
        if (!password || typeof password !== 'string') {
            return res.status(400).json({ message: 'Password is required and must be a string' });
        }

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Hash password with proper error handling
        let hashedPassword;
        try {
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(password, salt);
        } catch (hashError) {
            console.error('Password hashing failed:', hashError);
            return res.status(500).json({ message: 'Password processing failed' });
        }

        // Prepare user data with null checks
        const userData = {
            firstname: firstname || '',
            lastname: lastname || '',
            email: email || '',
            mobilenumber: mobilenumber || '',
            status: "Active",
            location: address || '',
            city: city || '',
            state: state || '',
            country: country || '',
            zipCode: zipCode || '',
            loginexpirydate: loginexpirydate ? new Date(loginexpirydate) : null,
            employeeid: employeeid || '',
            department: department || '',
            password: hashedPassword,
            manageremail: manageremail || '',
            profileimage: profileimage || '',
            deviceid: deviceid || '',
            // deviceregistereddate: new Date(),
            usertype: usertype || 'skanray',
            skills: skills || [],
            demographics: demographics || [],
            modifiedAt: new Date(),
            createdAt: new Date()
        };

        // Always assign role if available
        userData.role = {
            roleName: role?.roleName || '',
            roleId: role?.roleId || ''
        };

        // Only assign dealerInfo if user is a dealer
        if (usertype === 'dealer') {
            userData.dealerInfo = {
                dealerName: dealerInfo?.dealerName || '',
                dealerId: dealerInfo?.dealerId || '',
                dealerEmail: dealerInfo?.dealerEmail || '',
                dealerCode: dealerInfo?.dealerCode || '',
            };
        }


        // For backward compatibility
        const branchData = demographics?.find(d => d.type === 'branch');
        if (branchData) {
            userData.branch = branchData.values.map(v => v.name) || [];
        }

        const newUser = new User(userData);
        const savedUser = await newUser.save();

        res.status(201).json(savedUser);
    } catch (err) {
        console.error("Error creating user:", err);
        res.status(400).json({
            message: err.message,
            errorDetails: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});
router.post('/login/web', getUserForLogin, async (req, res) => {
    try {
        const user = res.user;

        // Verify password
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                message: 'Invalid password',
                errorCode: 'INVALID_CREDENTIALS'
            });
        }

        // Create token
        const token = jwt.sign(
            { id: user._id, email: user.email },
            "myservice-secret",
            { expiresIn: '8h' }
        );

        // Return success response
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                mobilenumber: user.mobilenumber,
                status: user.status,
                branch: user.branch,
                loginexpirydate: user.loginexpirydate,
                employeeid: user.employeeid,
                country: user.country,
                state: user.state,
                city: user.city,
                department: user.department,
                skills: user.skills,
                profileimage: user.profileimage,
                deviceid: user.deviceid,
                usertype: user.usertype,
                role: user.role,
                dealerInfo: user.dealerInfo,
                location: user.location
            }
        });

    } catch (err) {
        res.status(500).json({
            message: err.message,
            errorCode: 'SERVER_ERROR'
        });
    }
});

// LOGIN route
router.post('/login', getUserForLogin, async (req, res) => {
    try {
        const user = res.user;
        const currentDeviceId = req.body.deviceid;

        // Verify password
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                message: 'Invalid password',
                errorCode: 'INVALID_CREDENTIALS'
            });
        }

        // Check device registration if deviceid is required
        if (user.deviceid && user.deviceid !== currentDeviceId) {
            return res.status(403).json({
                message: 'User is already logged in on another device',
                errorCode: 'DEVICE_MISMATCH'
            });
        }

        // Update device information
        user.deviceid = currentDeviceId;
        user.deviceregistereddate = new Date();
        await user.save();

        // Create token
        const token = jwt.sign(
            { id: user._id, email: user.email },
            "myservice-secret",
            { expiresIn: '8h' }
        );

        // Return success response
        res.json({
            success: true,
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
        res.status(500).json({
            message: err.message,
            errorCode: 'SERVER_ERROR'
        });
    }
});
router.post('/remove-device', async (req, res) => {
    try {
        const { userId } = req.body; // frontend se userId ayega

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // Find user and clear device information
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    deviceid: null,
                    deviceregistereddate: null
                }
            },
            { new: true } // Return updated document
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'Device ID cleared successfully',
            user: updatedUser
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



// UPDATE a user
router.put('/user/:id', getUserById, checkDuplicateEmail, async (req, res) => {
    try {
        const user = res.user;

        // Basic fields
        const fieldsToUpdate = [
            'firstname', 'lastname', 'email', 'mobilenumber', 'address',
            'city', 'state', 'country', 'zipCode', 'loginexpirydate',
            'employeeid', 'department', 'manageremail', 'profileimage',
            'deviceid', 'usertype'
        ];

        fieldsToUpdate.forEach(field => {
            if (req.body[field] !== undefined) {
                user[field] = req.body[field];
            }
        });

        // Role update
        if (req.body.role && (req.body.role.roleName || req.body.role.roleId)) {
            user.role = {
                roleName: req.body.role.roleName || user.role?.roleName || '',
                roleId: req.body.role.roleId || user.role?.roleId || ''
            };
        }

        // Dealer info update (if usertype is 'dealer')
        if (req.body.usertype === 'dealer' && req.body.dealerInfo) {
            user.dealerInfo = {
                dealerName: req.body.dealerInfo.dealerName || user.dealerInfo?.dealerName || '',
                dealerId: req.body.dealerInfo.dealerId || user.dealerInfo?.dealerId || '',
                dealerEmail: req.body.dealerInfo.dealerEmail || user.dealerInfo?.dealerEmail || '',
                dealerCode: req.body.dealerInfo.dealerCode || user.dealerInfo?.dealerCode || '',
            };
        }

        // Skills update (Array of objects)
        if (Array.isArray(req.body.skills)) {
            user.skills = req.body.skills;
        }

        // Demographics update
        if (Array.isArray(req.body.demographics)) {
            user.demographics = req.body.demographics;

            // For backward compatibility, extract branch names from demographics
            const branchData = req.body.demographics.find(d => d.type === 'branch');
            if (branchData && Array.isArray(branchData.values)) {
                user.branch = branchData.values.map(v => v.name);
            }
        }

        // Location array
        if (Array.isArray(req.body.location)) {
            user.location = req.body.location;
        }

        user.modifiedAt = new Date(); // always update modified date

        const updatedUser = await user.save();
        res.json(updatedUser);
    } catch (err) {
        console.error('User update failed:', err);
        res.status(400).json({
            message: 'User update failed',
            errorDetails: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
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

router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const regexQuery = { $regex: q, $options: 'i' };

        const query = {
            $or: [
                { firstname: regexQuery },
                { lastname: regexQuery },
                { email: regexQuery },
                { mobilenumber: regexQuery },
                { status: regexQuery },
                { department: regexQuery },
                { manageremail: regexQuery },
                { usertype: regexQuery },
                { employeeid: regexQuery },
                { 'role.roleName': regexQuery },
                { 'role.roleId': regexQuery },
                { 'dealerInfo.dealerName': regexQuery },
                { 'dealerInfo.dealerId': regexQuery },
                { 'dealerInfo.dealerEmail': regexQuery },
                { 'dealerInfo.dealerCode': regexQuery },
                { zipCode: regexQuery },
                { branch: regexQuery },
                { location: regexQuery },
                { 'skills.productName': regexQuery },
                { 'skills.productGroup': regexQuery },
                { 'skills.partNumbers': regexQuery },
                { 'demographics.values.name': regexQuery },
            ]
        };

        const users = await User.find(query);
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
module.exports = router;
