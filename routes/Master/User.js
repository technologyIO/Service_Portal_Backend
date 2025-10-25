// Routes: userRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../../Model/MasterSchema/UserSchema');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Role = require('../../Model/Role/RoleSchema'); // Make sure you import the Role model
const authenticateToken = require('./auth'); // Make sure you import the Role model
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const activityLogsRouter = require('../activityLogger/activityLogs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            console.log('Created uploads directory');
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueName = `${uuidv4()}${ext}`;
        cb(null, uniqueName);
    }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'webadmin@skanray-access.com',
        pass: 'rdzegwmzirvbjcpm'
    }
});


// In-memory storage for OTPs (in production, use Redis or database)
const otpStore = new Map();
const getUserFullName = (user) => {
    return `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.email || 'Unknown User';
};
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
async function getUserForLogin(req, res, next) {
    let user;
    try {
        if (req.body.employeeid) {
            user = await User.findOne({ employeeid: req.body.employeeid });
        } else if (req.body.email) {
            user = await User.findOne({ email: req.body.email });
        }

        if (!user) {
            // Log failed login attempt
            await activityLogsRouter.logActivity({
                userId: 'system',
                userName: 'System',
                userEmail: 'system@skanray.com',
                userRole: 'System',
                action: 'login_failed',
                description: 'Login attempt failed - User not found',
                details: `Failed login attempt for: ${req.body.employeeid || req.body.email}`,
                module: 'Authentication',
                status: 'error',
                severity: 'medium',
                metadata: {
                    loginIdentifier: req.body.employeeid || req.body.email,
                    failureReason: 'User not found'
                },
                req
            });

            return res.status(404).json({
                message: 'User not found',
                errorCode: 'USER_NOT_FOUND'
            });
        }

        if (user.status === 'Deactive') {
            // Log deactivated account login attempt
            await activityLogsRouter.logActivity({
                userId: user._id,
                userName: getUserFullName(user),
                userEmail: user.email,
                userRole: user.role?.roleName || 'No Role',
                action: 'login_failed',
                description: 'Login attempt on deactivated account',
                details: `Deactivated account login attempt by: ${getUserFullName(user)} (${user.employeeid})`,
                module: 'Security',
                status: 'warning',
                severity: 'medium',
                metadata: {
                    accountStatus: 'Deactive',
                    failureReason: 'Account deactivated'
                },
                req
            });

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

// Generate OTP
function generateOTP() {
    return crypto.randomInt(1000, 9999).toString();
}

router.post('/forgot-password', async (req, res) => {
    try {
        const { employeeid } = req.body;

        if (!employeeid) {
            return res.status(400).json({
                message: 'Employee ID is required',
                errorCode: 'MISSING_EMPLOYEE_ID'
            });
        }

        const user = await User.findOne({ employeeid });
        if (!user) {
            // Log failed forgot password attempt
            await activityLogsRouter.logActivity({
                userId: 'system',
                userName: 'System',
                userEmail: 'system@skanray.com',
                userRole: 'System',
                action: 'forgot_password',
                description: 'Forgot password attempt failed - User not found',
                details: `Failed forgot password attempt for Employee ID: ${employeeid}`,
                module: 'Authentication',
                status: 'error',
                severity: 'low',
                req
            });

            return res.status(404).json({
                message: 'No account found with this Employee ID',
                errorCode: 'USER_NOT_FOUND'
            });
        }

        if (!user.email) {
            return res.status(400).json({
                message: 'No email registered with this account',
                errorCode: 'NO_EMAIL_REGISTERED'
            });
        }

        const otp = generateOTP();
        const otpExpiry = Date.now() + 5 * 60 * 1000;

        otpStore.set(employeeid, {
            otp,
            expiry: otpExpiry,
            email: user.email
        });

        const mailOptions = {
            from: 'webadmin@skanray-access.com',
            to: user.email,
            subject: 'Password Reset OTP',
            text: `Your OTP for password reset is: ${otp}. This OTP is valid for 5 minutes.`
        };

        await transporter.sendMail(mailOptions);

        // Log successful OTP send
        await activityLogsRouter.logActivity({
            userId: user._id,
            userName: getUserFullName(user),
            userEmail: user.email,
            userRole: user.role?.roleName || 'No Role',
            action: 'forgot_password',
            description: 'Password reset OTP requested',
            details: `OTP sent to email: ${user.email.replace(/(.{2}).+@/, "$1****@")}`,
            module: 'Authentication',
            status: 'success',
            severity: 'info',
            metadata: {
                maskedEmail: user.email.replace(/(.{2}).+@/, "$1****@")
            },
            req
        });

        res.json({
            success: true,
            message: 'OTP sent to registered email',
            email: user.email.replace(/(.{2}).+@/, "$1****@")
        });

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({
            message: 'Error sending OTP',
            errorCode: 'SERVER_ERROR'
        });
    }
});

router.post('/reset-password-otp', async (req, res) => {
    try {
        const { resetToken, newPassword, confirmPassword } = req.body;

        if (!resetToken || !newPassword || !confirmPassword) {
            return res.status(400).json({
                message: 'Reset token and passwords are required',
                errorCode: 'MISSING_FIELDS'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                message: 'Passwords do not match',
                errorCode: 'PASSWORD_MISMATCH'
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(resetToken, "myservice-secret");
        } catch (err) {
            return res.status(401).json({
                message: 'Invalid or expired token',
                errorCode: 'INVALID_TOKEN'
            });
        }

        if (decoded.purpose !== 'password_reset') {
            return res.status(401).json({
                message: 'Invalid token purpose',
                errorCode: 'INVALID_TOKEN_PURPOSE'
            });
        }

        const user = await User.findOne({ employeeid: decoded.employeeid });
        if (!user) {
            return res.status(404).json({
                message: 'User not found',
                errorCode: 'USER_NOT_FOUND'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password = hashedPassword;
        user.modifiedAt = new Date();
        await user.save();

        // Log successful password reset
        await activityLogsRouter.logActivity({
            userId: user._id,
            userName: getUserFullName(user),
            userEmail: user.email,
            userRole: user.role?.roleName || 'No Role',
            action: 'password_reset',
            description: 'Password reset completed via OTP',
            details: 'Password successfully updated using OTP verification',
            module: 'Authentication',
            status: 'success',
            severity: 'warning',
            req
        });

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (err) {
        console.error('Password reset error:', err);
        res.status(500).json({
            message: 'Error resetting password',
            errorCode: 'SERVER_ERROR'
        });
    }
});
router.post('/verify-otp-pass', async (req, res) => {
    try {
        const { employeeid, otp } = req.body;

        if (!employeeid || !otp) {
            return res.status(400).json({
                message: 'Employee ID and OTP are required',
                errorCode: 'MISSING_FIELDS'
            });
        }

        const user = await User.findOne({ employeeid });
        const otpData = otpStore.get(employeeid);

        if (!otpData) {
            // Log failed OTP verification
            if (user) {
                await activityLogsRouter.logActivity({
                    userId: user._id,
                    userName: getUserFullName(user),
                    userEmail: user.email,
                    userRole: user.role?.roleName || 'No Role',
                    action: 'otp_verify',
                    description: 'OTP verification failed - OTP not found',
                    details: 'OTP not found or expired',
                    module: 'Authentication',
                    status: 'error',
                    severity: 'medium',
                    req
                });
            }

            return res.status(400).json({
                message: 'OTP not found or expired. Please request a new one.',
                errorCode: 'OTP_NOT_FOUND'
            });
        }

        if (Date.now() > otpData.expiry) {
            otpStore.delete(employeeid);

            if (user) {
                await activityLogsRouter.logActivity({
                    userId: user._id,
                    userName: getUserFullName(user),
                    userEmail: user.email,
                    userRole: user.role?.roleName || 'No Role',
                    action: 'otp_verify',
                    description: 'OTP verification failed - OTP expired',
                    details: 'OTP expired',
                    module: 'Authentication',
                    status: 'error',
                    severity: 'low',
                    req
                });
            }

            return res.status(400).json({
                message: 'OTP expired. Please request a new one.',
                errorCode: 'OTP_EXPIRED'
            });
        }

        if (otp !== otpData.otp) {
            if (user) {
                await activityLogsRouter.logActivity({
                    userId: user._id,
                    userName: getUserFullName(user),
                    userEmail: user.email,
                    userRole: user.role?.roleName || 'No Role',
                    action: 'otp_verify',
                    description: 'OTP verification failed - Invalid OTP',
                    details: 'Invalid OTP entered',
                    module: 'Authentication',
                    status: 'error',
                    severity: 'medium',
                    req
                });
            }

            return res.status(400).json({
                message: 'Invalid OTP',
                errorCode: 'INVALID_OTP'
            });
        }

        const resetToken = jwt.sign(
            { employeeid, purpose: 'password_reset' },
            "myservice-secret",
            { expiresIn: '10m' }
        );

        otpStore.delete(employeeid);

        // Log successful OTP verification
        if (user) {
            await activityLogsRouter.logActivity({
                userId: user._id,
                userName: getUserFullName(user),
                userEmail: user.email,
                userRole: user.role?.roleName || 'No Role',
                action: 'otp_verify',
                description: 'OTP verified successfully',
                details: 'Password reset token generated',
                module: 'Authentication',
                status: 'success',
                severity: 'info',
                req
            });
        }

        res.json({
            success: true,
            message: 'OTP verified successfully',
            resetToken
        });

    } catch (err) {
        console.error('OTP verification error:', err);
        res.status(500).json({
            message: 'Error verifying OTP',
            errorCode: 'SERVER_ERROR'
        });
    }
});
// 4. Resend OTP
router.post('/resend-otp', async (req, res) => {
    try {
        const { employeeid } = req.body;

        if (!employeeid) {
            return res.status(400).json({
                message: 'Employee ID is required',
                errorCode: 'MISSING_EMPLOYEE_ID'
            });
        }

        // Find user by employee ID
        const user = await User.findOne({ employeeid });
        if (!user) {
            return res.status(404).json({
                message: 'No account found with this Employee ID',
                errorCode: 'USER_NOT_FOUND'
            });
        }

        // Generate new OTP
        const otp = generateOTP();
        const otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

        // Store OTP temporarily
        otpStore.set(employeeid, {
            otp,
            expiry: otpExpiry,
            email: user.email
        });

        // Send email with new OTP
        const mailOptions = {
            from: 'webadmin@skanray-access.com',
            to: user.email,
            subject: 'New Password Reset OTP',
            text: `Your new OTP for password reset is: ${otp}. This OTP is valid for 5 minutes.`
        };

        await transporter.sendMail(mailOptions);

        res.json({
            success: true,
            message: 'New OTP sent to registered email',
            email: user.email.replace(/(.{2}).+@/, "$1****@") // mask email for display
        });

    } catch (err) {
        console.error('Resend OTP error:', err);
        res.status(500).json({
            message: 'Error resending OTP',
            errorCode: 'SERVER_ERROR'
        });
    }
});
// Password reset API
router.post('/reset-password', async (req, res) => {
    try {
        const { employeeid, oldPassword, newPassword } = req.body;

        if (!employeeid || !oldPassword || !newPassword) {
            return res.status(400).json({
                message: 'Employee ID, old password and new password are required',
                errorCode: 'MISSING_FIELDS'
            });
        }

        const user = await User.findOne({ employeeid });
        if (!user) {
            return res.status(404).json({
                message: 'User not found with this employee ID',
                errorCode: 'USER_NOT_FOUND'
            });
        }

        if (user.status !== 'Active') {
            return res.status(403).json({
                message: 'Your account is deactivated. Please contact administrator.',
                errorCode: 'ACCOUNT_DEACTIVATED'
            });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            // Log failed password change attempt
            await activityLogsRouter.logActivity({
                userId: user._id,
                userName: getUserFullName(user),
                userEmail: user.email,
                userRole: user.role?.roleName || 'No Role',
                action: 'password_change',
                description: 'Password change failed - Invalid old password',
                details: 'User provided incorrect old password',
                module: 'Authentication',
                status: 'error',
                severity: 'medium',
                req
            });

            return res.status(400).json({
                message: 'Old password is incorrect',
                errorCode: 'INVALID_OLD_PASSWORD'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password = hashedPassword;
        user.modifiedAt = new Date();
        await user.save();

        // Log successful password change
        await activityLogsRouter.logActivity({
            userId: user._id,
            userName: getUserFullName(user),
            userEmail: user.email,
            userRole: user.role?.roleName || 'No Role',
            action: 'password_change',
            description: 'Password changed successfully',
            details: 'User changed password using old password verification',
            module: 'Authentication',
            status: 'success',
            severity: 'info',
            req
        });

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (err) {
        console.error('Password reset error:', err);
        res.status(500).json({
            message: 'Error resetting password',
            errorCode: 'SERVER_ERROR'
        });
    }
});
router.delete('/user/bulk', async (req, res) => {
    try {
        const { ids } = req.body;

        // Validate input
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Please provide valid IDs array' });
        }

        // Validate ObjectIds
        const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIds.length === 0) {
            return res.status(400).json({ message: 'No valid IDs provided' });
        }

        // Delete multiple users
        const deleteResult = await User.deleteMany({
            _id: { $in: validIds }
        });

        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({
                message: 'No users found to delete',
                deletedCount: 0
            });
        }

        res.json({
            message: `Successfully deleted ${deleteResult.deletedCount} users`,
            deletedCount: deleteResult.deletedCount,
            requestedCount: validIds.length
        });

    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ message: err.message });
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

router.get('/user/technicians', async (req, res) => {
    try {
        const technicians = await User.find({
            status: 'Active',
            // Only include users with non-expired login
            $or: [
                { loginexpirydate: { $exists: false } },
                { loginexpirydate: null },
                { loginexpirydate: { $gte: new Date() } }
            ]
        })
            .select('firstname lastname email employeeid role.roleName department')
            .sort({ firstname: 1 })
            .lean();

        // Transform data
        const transformedTechnicians = technicians.map(tech => ({
            _id: tech._id,
            name: `${tech.firstname} ${tech.lastname || ''}`.trim(),
            email: tech.email,
            employeeid: tech.employeeid,
            role: tech.role?.roleName || 'User'
        }));

        res.json({
            success: true,
            data: transformedTechnicians
        });

    } catch (error) {
        console.error('Error fetching technicians:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching technicians',
            error: error.message
        });
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
        res.json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});
const checkDuplicateEmployeeId = async (req, res, next) => {
    try {
        const { employeeid } = req.body;

        if (!employeeid) return res.status(400).json({ message: 'Employee ID is required' });

        const existingUser = await User.findOne({ employeeid });
        if (existingUser) {
            return res.status(400).json({ message: 'Employee ID already exists' });
        }

        next();
    } catch (err) {
        console.error("Error checking duplicate employee ID:", err);
        res.status(500).json({ message: 'Server error during employee ID check' });
    }
};



router.post('/user', upload.single('profileimage'), async (req, res) => {
    try {
        // Parse JSON fields that were stringified in the frontend
        const parseField = (field) => {
            try {
                return field ? JSON.parse(field) : (Array.isArray(field) ? field : []);
            } catch (e) {
                return [];
            }
        }

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
            manageremail,
            deviceid,
            usertype,
            role,
            dealerInfo,
            skills,
            demographics
        } = req.body;

        // Basic validation
        if (!email) {
            // Clean up uploaded file if validation fails
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({
                message: 'Email is required',
                field: 'email'
            });
        }

        // Check for duplicate email
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({
                message: 'Email already exists',
                field: 'email'
            });
        }

        // Use default password and hash it
        const defaultPassword = "Skanray@123";
        let hashedPassword;
        try {
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(defaultPassword, salt);
        } catch (hashError) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(500).json({
                message: 'Password processing failed',
                error: hashError.message
            });
        }

        // Handle profile image
        let profileImageUrl = '';
        if (req.file) {
            profileImageUrl = `/uploads/${req.file.filename}`;
        }

        // Prepare user object with proper data types
        const userData = {
            firstname: firstname?.trim() || '',
            lastname: lastname?.trim() || '',
            email: email.toLowerCase().trim(),
            mobilenumber: mobilenumber?.trim() || '',
            status: "Active",
            location: address?.trim() || '',
            city: city?.trim() || '',
            state: state?.trim() || '',
            country: country?.trim() || '',
            zipCode: zipCode?.trim() || '',
            loginexpirydate: loginexpirydate ? new Date(loginexpirydate) : null,
            employeeid: employeeid?.trim() || '',
            department: department?.trim() || '',
            password: hashedPassword,
            manageremail: parseField(manageremail),
            profileimage: profileImageUrl,
            deviceid: deviceid?.trim() || '',
            usertype: usertype?.toLowerCase() || 'skanray',
            skills: parseField(skills),
            demographics: parseField(demographics),
            modifiedAt: new Date(),
            createdAt: new Date()
        };

        // Add role info with validation
        if (role) {
            userData.role = {
                roleName: role.roleName?.trim() || '',
                roleId: role.roleId?.trim() || ''
            };
        }

        // Dealer info validation if applicable
        if (usertype?.toLowerCase() === 'dealer' && dealerInfo) {
            userData.dealerInfo = {
                dealerName: dealerInfo.dealerName?.trim() || '',
                dealerId: dealerInfo.dealerId?.trim() || '',
                dealerEmail: dealerInfo.dealerEmail?.trim() || '',
                dealerCode: dealerInfo.dealerCode?.trim() || '',
            };
        }

        // Backward compatibility for branch
        const branchData = userData.demographics?.find(d => d.type === 'branch');
        if (branchData) {
            userData.branch = branchData.values?.map(v => v.name?.trim()).filter(Boolean) || [];
        }

        // Create and save user
        const newUser = new User(userData);
        const savedUser = await newUser.save();
        await activityLogsRouter.logActivity({
            userId: 'system', // You might want to pass admin user ID here
            userName: 'Admin User',
            userEmail: 'admin@skanray.com',
            userRole: 'Admin',
            action: 'create',
            description: 'New user account created',
            details: `Created user: ${getUserFullName(savedUser)} (${savedUser.employeeid}), Type: ${savedUser.usertype}, Role: ${savedUser.role?.roleName || 'No Role'}`,
            module: 'User Management',
            status: 'success',
            severity: 'info',
            relatedId: savedUser._id.toString(),
            relatedModel: 'User',
            metadata: {
                newUserType: savedUser.usertype,
                newUserRole: savedUser.role,
                newUserDepartment: savedUser.department
            },
            req
        });
        // Send response without sensitive data
        const userResponse = savedUser.toObject();
        delete userResponse.password;
        delete userResponse.__v;

        // Send email with credentials
        const mailOptions = {
            from: 'webadmin@skanray-access.com',
            to: email,
            subject: 'Your Account Credentials',
            text: `Dear ${firstname || 'User'},

Your account has been successfully created. Here are your login details:

Employee ID: ${employeeid || 'Not provided'}
Password: ${defaultPassword}

Please use these credentials to log in to the system. We recommend changing your password after first login.

Best regards,
Skanray Team`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                // Don't fail the request if email fails, just log it
            } else {
                console.log('Email sent:', info.response);
            }
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: userResponse
        });

    } catch (err) {
        console.error("Error creating user:", err);

        // Clean up uploaded file if error occurs
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('Error cleaning up uploaded file:', cleanupError);
            }
        }

        // Determine appropriate status code
        const statusCode = err.name === 'ValidationError' ? 400 : 500;

        res.status(statusCode).json({
            success: false,
            message: err.message || 'Failed to create user',
            error: process.env.NODE_ENV === 'development' ? {
                name: err.name,
                stack: err.stack,
                ...err
            } : undefined
        });
    }
});



router.post('/login/web', getUserForLogin, async (req, res) => {
    try {
        const user = res.user;

        if (!user.loginexpirydate) {
            return res.status(403).json({
                message: 'You do not have a login expiry date. You cannot login.',
                errorCode: 'NO_LOGIN_EXPIRY'
            });
        }

        const currentDate = new Date();
        const expiryDate = new Date(user.loginexpirydate);

        if (currentDate > expiryDate) {
            // Log expired login attempt
            await activityLogsRouter.logActivity({
                userId: user._id,
                userName: getUserFullName(user),
                userEmail: user.email,
                userRole: user.role?.roleName || 'No Role',
                action: 'login_failed',
                description: 'Login failed - Account expired',
                details: `Login expiry date: ${expiryDate.toDateString()}`,
                module: 'Authentication',
                status: 'warning',
                severity: 'medium',
                metadata: {
                    expiryDate: expiryDate,
                    loginType: 'web'
                },
                req
            });

            return res.status(403).json({
                message: 'Your login date has expired. Please contact admin.',
                errorCode: 'LOGIN_EXPIRED'
            });
        }

        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            // Log failed password attempt
            await activityLogsRouter.logActivity({
                userId: user._id,
                userName: getUserFullName(user),
                userEmail: user.email,
                userRole: user.role?.roleName || 'No Role',
                action: 'login_failed',
                description: 'Web login failed - Invalid password',
                details: 'Incorrect password provided',
                module: 'Authentication',
                status: 'error',
                severity: 'medium',
                metadata: {
                    loginType: 'web'
                },
                req
            });

            return res.status(400).json({
                message: 'Invalid password',
                errorCode: 'INVALID_CREDENTIALS'
            });
        }

        const token = jwt.sign(
            { id: user._id, email: user.email },
            "myservice-secret",
            { expiresIn: '8h' }
        );

        // Log successful web login
        await activityLogsRouter.logActivity({
            userId: user._id,
            userName: getUserFullName(user),
            userEmail: user.email,
            userRole: user.role?.roleName || 'No Role',
            action: 'login',
            description: 'User logged in via web portal',
            details: `Successful web login. Role: ${user.role?.roleName || 'No Role'}, Department: ${user.department || 'N/A'}`,
            module: 'Authentication',
            status: 'success',
            severity: 'info',
            metadata: {
                loginType: 'web',
                usertype: user.usertype,
                department: user.department,
                tokenExpiry: '8h'
            },
            req
        });

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
                manageremail: user.manageremail,
                country: user.country,
                state: user.state,
                city: user.city,
                department: user.department,
                skills: user.skills,
                demographics: user.demographics,
                profileimage: user.profileimage,
                deviceid: user.deviceid,
                usertype: user.usertype,
                role: user.role,
                dealerInfo: user.dealerInfo,
                location: user.location
            }
        });

    } catch (err) {
        await activityLogsRouter.quickLog.error(res.user, err, 'Authentication', req);
        res.status(500).json({
            message: err.message,
            errorCode: 'SERVER_ERROR'
        });
    }
});


router.post('/login', getUserForLogin, async (req, res) => {
    try {
        const user = res.user;
        const currentDeviceId = req.body.deviceid;

        if (!user.loginexpirydate) {
            return res.status(403).json({
                message: 'You do not have a login expiry date. You cannot login.',
                errorCode: 'NO_LOGIN_EXPIRY'
            });
        }

        const currentDate = new Date();
        const expiryDate = new Date(user.loginexpirydate);

        if (currentDate > expiryDate) {
            // Log expired mobile login attempt
            await activityLogsRouter.logActivity({
                userId: user._id,
                userName: getUserFullName(user),
                userEmail: user.email,
                userRole: user.role?.roleName || 'No Role',
                action: 'login_failed',
                description: 'Mobile login failed - Account expired',
                details: `Login expiry date: ${expiryDate.toDateString()}`,
                module: 'Authentication',
                status: 'warning',
                severity: 'medium',
                metadata: {
                    expiryDate: expiryDate,
                    loginType: 'mobile',
                    deviceId: currentDeviceId
                },
                req
            });

            return res.status(403).json({
                message: 'Your login date has expired. Please contact admin.',
                errorCode: 'LOGIN_EXPIRED'
            });
        }

        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            // Log failed mobile password attempt
            await activityLogsRouter.logActivity({
                userId: user._id,
                userName: getUserFullName(user),
                userEmail: user.email,
                userRole: user.role?.roleName || 'No Role',
                action: 'login_failed',
                description: 'Mobile login failed - Invalid password',
                details: 'Incorrect password provided',
                module: 'Authentication',
                status: 'error',
                severity: 'medium',
                metadata: {
                    loginType: 'mobile',
                    deviceId: currentDeviceId
                },
                req
            });

            return res.status(400).json({
                message: 'Invalid password',
                errorCode: 'INVALID_CREDENTIALS'
            });
        }

        const roleId = user.role?.roleId;
        if (!roleId) {
            return res.status(403).json({
                message: "No role assigned to user",
                errorCode: "NO_ROLE"
            });
        }

        const roleData = await Role.findOne({ roleId });

        if (!roleData || !Array.isArray(roleData.mobileComponents) || roleData.mobileComponents.length === 0) {
            // Log mobile access denied
            await activityLogsRouter.logActivity({
                userId: user._id,
                userName: getUserFullName(user),
                userEmail: user.email,
                userRole: user.role?.roleName || 'No Role',
                action: 'login_failed',
                description: 'Mobile login denied - No mobile access',
                details: 'User role does not have mobile app permissions',
                module: 'Security',
                status: 'warning',
                severity: 'medium',
                metadata: {
                    loginType: 'mobile',
                    roleId: roleId,
                    deviceId: currentDeviceId
                },
                req
            });

            return res.status(403).json({
                message: "You don't have access to the mobile app. Please contact admin.",
                errorCode: "MOBILE_ACCESS_DENIED"
            });
        }

        if (user.deviceid && user.deviceid !== currentDeviceId) {
            // Log device mismatch
            await activityLogsRouter.logActivity({
                userId: user._id,
                userName: getUserFullName(user),
                userEmail: user.email,
                userRole: user.role?.roleName || 'No Role',
                action: 'login_failed',
                description: 'Mobile login failed - Device mismatch',
                details: `Attempted login from different device. Registered: ${user.deviceid}, Attempted: ${currentDeviceId}`,
                module: 'Security',
                status: 'warning',
                severity: 'high',
                metadata: {
                    registeredDevice: user.deviceid,
                    attemptedDevice: currentDeviceId,
                    loginType: 'mobile'
                },
                req
            });

            return res.status(403).json({
                message: 'User is already logged in on another device',
                errorCode: 'DEVICE_MISMATCH'
            });
        }

        const calculateExpiryAt10PM = () => {
            const now = new Date();
            const today10PM = new Date(now);
            today10PM.setHours(22, 0, 0, 0);

            if (now > today10PM) {
                const tomorrow10PM = new Date(today10PM);
                tomorrow10PM.setDate(tomorrow10PM.getDate() + 1);
                return tomorrow10PM;
            }
            return today10PM;
        };

        const expiryTime = calculateExpiryAt10PM();
        const expiryInSeconds = Math.floor((expiryTime - new Date()) / 1000);

        user.deviceid = currentDeviceId;
        user.deviceregistereddate = new Date();
        user.sessionExpiry = expiryTime;
        await user.save();

        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                exp: Math.floor(expiryTime.getTime() / 1000)
            },
            "myservice-secret"
        );

        // Log successful mobile login
        await activityLogsRouter.logActivity({
            userId: user._id,
            userName: getUserFullName(user),
            userEmail: user.email,
            userRole: user.role?.roleName || 'No Role',
            action: 'login',
            description: 'User logged in via mobile app',
            details: `Successful mobile login. Device registered: ${currentDeviceId}`,
            module: 'Authentication',
            status: 'success',
            severity: 'info',
            metadata: {
                loginType: 'mobile',
                usertype: user.usertype,
                deviceId: currentDeviceId,
                sessionExpiry: expiryTime,
                department: user.department
            },
            req
        });

        res.json({
            success: true,
            token,
            expiryTime: expiryTime.toISOString(),
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
                manageremail: user.manageremail,
                country: user.country,
                state: user.state,
                city: user.city,
                department: user.department,
                skills: user.skills,
                demographics: user.demographics,
                profileimage: user.profileimage,
                deviceid: user.deviceid,
                usertype: user.usertype,
                role: user.role,
                dealerInfo: user.dealerInfo,
                location: user.location
            }
        });

    } catch (err) {
        await activityLogsRouter.quickLog.error(res.user, err, 'Authentication', req);
        res.status(500).json({
            message: err.message,
            errorCode: 'SERVER_ERROR'
        });
    }
});


router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const loginType = user.deviceid ? 'mobile' : 'web'; // Detect login type

        // Log logout
        await activityLogsRouter.logActivity({
            userId: user._id,
            userName: getUserFullName(user),
            userEmail: user.email,
            userRole: user.role?.roleName || 'No Role',
            action: 'logout',
            description: `User logged out from ${loginType}`,
            details: user.deviceid ? `Device ${user.deviceid} session ended` : 'Web session ended',
            module: 'Authentication',
            status: 'success',
            severity: 'info',
            metadata: {
                loginType: loginType,
                deviceId: user.deviceid,
                sessionDuration: user.deviceregistereddate ?
                    Math.round((new Date() - new Date(user.deviceregistereddate)) / 1000 / 60) + ' minutes' : 'Unknown'
            },
            req
        });

        // Clear device info and session expiry
        user.deviceid = null;
        user.sessionExpiry = null;
        user.deviceregistereddate = null;
        await user.save();

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        await activityLogsRouter.quickLog.error(req.user, error, 'Authentication', req);
        res.status(500).json({
            message: 'Logout failed',
            errorCode: 'LOGOUT_ERROR'
        });
    }
});



router.patch('/user/:id/status', getUserById, async (req, res) => {
    try {
        const { status, adminEmployeeId } = req.body; // Get admin employee ID from request body
        const user = res.user;

        if (!status || !['Active', 'Deactive'].includes(status)) {
            return res.status(400).json({
                message: 'Status is required and must be either "Active" or "Deactive"',
                errorCode: 'INVALID_STATUS'
            });
        }

        if (user.status === status) {
            return res.json({
                message: `User is already ${status}`,
                user,
                warningCode: 'STATUS_UNCHANGED'
            });
        }

        const previousStatus = user.status;
        user.status = status;
        user.modifiedAt = new Date();

        if (status === 'Deactive') {
            user.deviceid = null;
            user.deviceregistereddate = null;
        }

        const updatedUser = await user.save();

        // Log status change with admin employee ID
        await activityLogsRouter.quickLog.userStatusChange(adminEmployeeId, user, status, req);

        res.json({
            success: true,
            message: `User ${status === 'Active' ? 'reactivated' : 'deactivated'} successfully`,
            user: updatedUser,
            statusChanged: true,
            actionPerformedBy: adminEmployeeId || 'System'
        });

    } catch (err) {
        await activityLogsRouter.quickLog.error(null, err, 'User Management', req);
        res.status(500).json({
            message: err.message,
            errorCode: 'SERVER_ERROR'
        });
    }
});

// Device removal with admin employee ID from payload
router.post('/remove-device', async (req, res) => {
    try {
        const { userId, adminEmployeeId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const clearedDeviceId = user.deviceid;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    deviceid: null,
                    deviceregistereddate: null
                }
            },
            { new: true }
        );

        // Log device removal with admin employee ID
        await activityLogsRouter.quickLog.deviceRemove(adminEmployeeId, user, req);

        res.json({
            success: true,
            message: 'Device ID cleared successfully',
            user: updatedUser,
            clearedDeviceId: clearedDeviceId,
            actionPerformedBy: adminEmployeeId || 'System'
        });
    } catch (err) {
        await activityLogsRouter.quickLog.error(null, err, 'Device Management', req);
        res.status(500).json({
            success: false,
            message: err.message,
            errorCode: 'SERVER_ERROR'
        });
    }
});


// UPDATE a user
router.put('/user/:id', upload.single('profileimage'), getUserById, checkDuplicateEmail, async (req, res) => {
    try {
        const user = res.user;
        const oldProfileImage = user.profileimage; // Store old image path for cleanup

        // Parse JSON fields that might be stringified
        const parseField = (field) => {
            try {
                return field ? JSON.parse(field) : (Array.isArray(field) ? field : []);
            } catch (e) {
                return [];
            }
        };

        if (req.file) {
            // Delete old image if it exists
            if (oldProfileImage) {
                const oldImagePath = path.join(__dirname, '../../../', oldProfileImage.replace('/uploads/', ''));
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            user.profileimage = `/uploads/${req.file.filename}`; // Updated path
        } else if (req.body.removeProfileImage === 'true') {
            // Handle explicit profile image removal
            if (oldProfileImage) {
                const oldImagePath = path.join(__dirname, '../../../', oldProfileImage);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            user.profileimage = '';
        }


        // Basic fields update with validation
        const fieldsToUpdate = [
            'firstname', 'lastname', 'email', 'mobilenumber', 'address',
            'city', 'state', 'country', 'zipCode', 'loginexpirydate',
            'employeeid', 'department', 'deviceid', 'usertype'
        ];

        fieldsToUpdate.forEach(field => {
            if (req.body[field] !== undefined) {
                user[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
            }
        });

        // Email case normalization
        if (req.body.email) {
            user.email = req.body.email.toLowerCase().trim();
        }

        // Manager email update (could be string or array)
        if (req.body.manageremail !== undefined) {
            user.manageremail = parseField(req.body.manageremail);
        }

        // Role update
        if (req.body.role) {
            user.role = {
                roleName: req.body.role.roleName?.trim() || user.role?.roleName || '',
                roleId: req.body.role.roleId?.trim() || user.role?.roleId || ''
            };
        }

        // Dealer info update
        if (req.body.usertype === 'dealer') {
            user.dealerInfo = {
                dealerName: req.body.dealerInfo?.dealerName?.trim() || user.dealerInfo?.dealerName || '',
                dealerId: req.body.dealerInfo?.dealerId?.trim() || user.dealerInfo?.dealerId || '',
                dealerEmail: req.body.dealerInfo?.dealerEmail?.trim() || user.dealerInfo?.dealerEmail || '',
                dealerCode: req.body.dealerInfo?.dealerCode?.trim() || user.dealerInfo?.dealerCode || ''
            };
        } else {
            // Clear dealer info if user type changed from dealer
            user.dealerInfo = undefined;
        }

        // Skills update
        if (req.body.skills !== undefined) {
            user.skills = parseField(req.body.skills);
        }

        // Demographics update
        if (req.body.demographics !== undefined) {
            user.demographics = parseField(req.body.demographics);

            // Backward compatibility for branch
            const branchData = user.demographics.find(d => d.type === 'branch');
            if (branchData) {
                user.branch = branchData.values?.map(v => v.name?.trim()).filter(Boolean) || [];
            }
        }

        // Location update
        if (req.body.location !== undefined) {
            user.location = Array.isArray(req.body.location)
                ? req.body.location.map(loc => loc?.trim()).filter(Boolean)
                : [req.body.location?.trim()].filter(Boolean);
        }

        user.modifiedAt = new Date();

        const updatedUser = await user.save();
        await activityLogsRouter.logUserActivity(req, res);

        // Prepare response without sensitive data
        const userResponse = updatedUser.toObject();
        delete userResponse.password;
        delete userResponse.__v;

        res.json({
            success: true,
            message: 'User updated successfully',
            user: userResponse
        });

    } catch (err) {
        console.error('User update failed:', err);

        // Clean up uploaded file if error occurs
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('Error cleaning up uploaded file:', cleanupError);
            }
        }

        const statusCode = err.name === 'ValidationError' ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: err.message || 'User update failed',
            error: process.env.NODE_ENV === 'development' ? {
                name: err.name,
                stack: err.stack,
                ...err
            } : undefined
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



module.exports = router;
