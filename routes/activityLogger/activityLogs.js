// routes/activityLogs.js - Enhanced with Universal Logging Function

const express = require('express');
const mongoose = require('mongoose');
const User = require('../../Model/MasterSchema/UserSchema');
const router = express.Router();

// ===== MONGODB SCHEMA - Same as your current schema =====
const activityLogSchema = new mongoose.Schema({
    // User Information
    user: {
        id: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        role: {
            type: String,
            required: true
        },
        avatar: {
            type: String,
            default: ''
        },
        employeeId: {
            type: String,
            default: ''
        }
    },

    // Action Details
    action: {
        type: String,
        required: true,
    },

    // Description and Details
    description: {
        type: String,
        required: true
    },
    details: {
        type: String,
        default: ''
    },

    // Module/Section
    module: {
        type: String,
        required: true,
    },

    // Status and Severity
    status: {
        type: String,
        required: true,
        enum: ['success', 'warning', 'error', 'info'],
        default: 'info'
    },
    severity: {
        type: String,
        required: true,
        enum: ['low', 'info', 'medium', 'warning', 'high', 'critical'],
        default: 'info'
    },

    // Technical Details
    ipAddress: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    },
    device: {
        type: String,
        default: ''
    },

    // Related Data
    relatedId: {
        type: String,
        default: ''
    },
    relatedModel: {
        type: String,
        default: ''
    },

    // Admin Info (who performed the action)
    adminInfo: {
        employeeId: {
            type: String,
            default: ''
        },
        name: {
            type: String,
            default: ''
        },
        email: {
            type: String,
            default: ''
        }
    },

    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Timestamps
    timestamp: {
        type: Date,
        default: Date.now
    },

    // Auto-delete after 30 days
    expiresAt: {
        type: Date,
        default: Date.now,
        expires: 2592000 // 30 days
    }
}, {
    timestamps: true,
    collection: 'activity_logs'
});

// Indexes for performance
activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ 'user.id': 1, timestamp: -1 });
activityLogSchema.index({ 'user.employeeId': 1, timestamp: -1 });
activityLogSchema.index({ 'adminInfo.employeeId': 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ module: 1, timestamp: -1 });
activityLogSchema.index({ status: 1, timestamp: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

// ===== UTILITY FUNCTIONS =====

// Create system ObjectId for consistent system user
const SYSTEM_USER_ID = new mongoose.Types.ObjectId('000000000000000000000001');

// Get device type from user agent
const getDeviceType = (userAgent) => {
    if (!userAgent) return 'Unknown';

    if (/mobile/i.test(userAgent)) return 'Mobile';
    if (/tablet/i.test(userAgent)) return 'Tablet';
    if (/chrome/i.test(userAgent)) return 'Chrome Browser';
    if (/firefox/i.test(userAgent)) return 'Firefox Browser';
    if (/safari/i.test(userAgent)) return 'Safari Browser';

    return 'Desktop Browser';
};

// Get user's full name
const getUserFullName = (user) => {
    return `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.email || 'Unknown User';
};

// Get admin user by employee ID
const getAdminByEmployeeId = async (employeeId) => {
    try {
        if (!employeeId) return null;
        
        const adminUser = await User.findOne({ employeeid: employeeId });
        return adminUser;
    } catch (error) {
        console.error('Error fetching admin user:', error);
        return null;
    }
};

// Main activity logger function
const logActivity = async ({
    userId,
    userName,
    userEmail,
    userRole,
    userAvatar = '',
    userEmployeeId = '',
    action,
    description,
    details = '',
    module,
    status = 'success',
    severity = 'info',
    ipAddress = '',
    userAgent = '',
    device = '',
    relatedId = '',
    relatedModel = '',
    metadata = {},
    req = null,
    adminEmployeeId = null
}) => {
    try {
        // Extract info from request if provided
        if (req) {
            ipAddress = ipAddress || req.ip || req.connection?.remoteAddress || '';
            userAgent = userAgent || req.get('User-Agent') || '';
            device = device || getDeviceType(userAgent);
        }

        // Fetch admin user data if employee ID provided
        let adminUser = null;
        if (adminEmployeeId) {
            adminUser = await getAdminByEmployeeId(adminEmployeeId);
        }

        // Handle system actions properly
        let finalUserId;
        let finalUserName;
        let finalUserEmail;
        let finalUserRole;
        let finalUserEmployeeId;

        if (userId === 'system') {
            if (adminUser) {
                finalUserId = adminUser._id;
                finalUserName = getUserFullName(adminUser);
                finalUserEmail = adminUser.email;
                finalUserRole = adminUser.role?.roleName || 'Admin';
                finalUserEmployeeId = adminUser.employeeid;
            } else {
                finalUserId = SYSTEM_USER_ID;
                finalUserName = 'System Administrator';
                finalUserEmail = 'admin@skanray.com';
                finalUserRole = 'Admin';
                finalUserEmployeeId = 'SYSTEM';
            }
        } else {
            finalUserId = userId;
            finalUserName = userName;
            finalUserEmail = userEmail;
            finalUserRole = userRole;
            finalUserEmployeeId = userEmployeeId;
        }

        const logEntry = new ActivityLog({
            user: {
                id: finalUserId,
                name: finalUserName,
                email: finalUserEmail,
                role: finalUserRole,
                employeeId: finalUserEmployeeId,
                avatar: userAvatar || finalUserName?.split(' ').map(n => n[0]).join('') || ''
            },
            action,
            description,
            details,
            module,
            status,
            severity,
            ipAddress,
            userAgent,
            device,
            relatedId,
            relatedModel,
            adminInfo: adminUser ? {
                employeeId: adminUser.employeeid,
                name: getUserFullName(adminUser),
                email: adminUser.email
            } : {},
            metadata,
            timestamp: new Date()
        });

        await logEntry.save();
        return logEntry;
    } catch (error) {
        console.error('Activity logging error:', error);
        return null;
    }
};

// ===== UNIVERSAL LOGGING FUNCTION - Main Feature =====
// This function can be used in ANY API with minimal code
const logUserActivity = async (req, res, options = {}) => {
    try {
        // Get admin employee ID from request
        const adminEmployeeId = req.body?.adminEmployeeId || req.query?.adminEmployeeId || req.headers?.['x-admin-employee-id'];
        
        // Auto-detect action from HTTP method and path if not provided
        const autoAction = options.action || getAutoAction(req.method, req.path);
        
        // Auto-detect module from path if not provided
        const autoModule = options.module || getAutoModule(req.path);
        
        // Auto-detect description if not provided
        const autoDescription = options.description || getAutoDescription(req.method, req.path, options);
        
        // Get target user from various sources
        let targetUser = null;
        if (res.user) {
            targetUser = res.user; // From middleware like getUserById
        } else if (options.targetUser) {
            targetUser = options.targetUser; // Passed directly
        } else if (req.user) {
            targetUser = req.user; // From auth middleware
        }

        // Build log data
        const logData = {
            userId: options.userId || targetUser?._id || 'system',
            userName: options.userName || (targetUser ? getUserFullName(targetUser) : 'System Administrator'),
            userEmail: options.userEmail || targetUser?.email || 'admin@skanray.com',
            userRole: options.userRole || targetUser?.role?.roleName || 'Admin',
            userAvatar: options.userAvatar || targetUser?.profileimage || targetUser?.avatar,
            userEmployeeId: options.userEmployeeId || targetUser?.employeeid,
            action: autoAction,
            description: autoDescription,
            details: options.details || getAutoDetails(req, res, options),
            module: autoModule,
            status: options.status || 'success',
            severity: options.severity || 'info',
            relatedId: options.relatedId || targetUser?._id?.toString() || req.params?.id || '',
            relatedModel: options.relatedModel || 'User',
            metadata: {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                ...(options.metadata || {})
            },
            req,
            adminEmployeeId
        };

        await logActivity(logData);
    } catch (error) {
        console.error('Universal activity logging failed:', error);
    }
};

// Helper functions for auto-detection
const getAutoAction = (method, path) => {
    if (path.includes('status')) return 'account_activate';
    if (path.includes('remove-device')) return 'device_remove';
    if (path.includes('login')) return 'login';
    if (path.includes('logout')) return 'logout';
    
    switch (method) {
        case 'POST': return 'create';
        case 'PUT':
        case 'PATCH': return 'update';
        case 'DELETE': return 'delete';
        case 'GET': return 'view';
        default: return 'action';
    }
};

const getAutoModule = (path) => {
    if (path.includes('/user')) return 'User Management';
    if (path.includes('/equipment')) return 'Equipment Management';
    if (path.includes('/customer')) return 'Customer Management';
    if (path.includes('/device')) return 'Device Management';
    if (path.includes('/auth')) return 'Authentication';
    return 'System';
};

const getAutoDescription = (method, path, options) => {
    if (path.includes('status')) return 'User account status changed';
    if (path.includes('remove-device')) return 'User device registration cleared';
    if (path.includes('login')) return 'User logged into the system';
    if (path.includes('logout')) return 'User logged out of the system';
    
    switch (method) {
        case 'POST': return 'Record created';
        case 'PUT':
        case 'PATCH': return 'Record updated';
        case 'DELETE': return 'Record deleted';
        case 'GET': return 'Record viewed';
        default: return 'Action performed';
    }
};

const getAutoDetails = (req, res, options) => {
    const user = res.user || options.targetUser;
    if (!user) return options.details || 'No additional details';

    if (req.path.includes('status')) {
        return `Changed status to: ${req.body?.status}`;
    } else if (req.path.includes('remove-device')) {
        return `Cleared device for user: ${getUserFullName(user)} (${user.employeeid})`;
    } else if (req.method === 'PUT' || req.method === 'PATCH') {
        const changedFields = Object.keys(req.body).filter(key => 
            !['adminEmployeeId', 'password'].includes(key)
        );
        return `Updated fields: ${changedFields.join(', ')}`;
    }
    
    return options.details || `Action performed on user: ${getUserFullName(user)} (${user.employeeid || 'N/A'})`;
};

// Enhanced quick log functions (keep all your existing ones)
const quickLog = {
    // Login log
    login: async (user, req) => {
        return logActivity({
            userId: user._id,
            userName: getUserFullName(user),
            userEmail: user.email,
            userRole: user.role?.roleName || user.role || 'User',
            userAvatar: user.profileimage || user.avatar,
            userEmployeeId: user.employeeid,
            action: 'login',
            description: 'User logged into the system',
            details: `Login successful from ${req?.ip || 'unknown IP'}`,
            module: 'Authentication',
            status: 'success',
            severity: 'info',
            req
        });
    },

    // Logout log
    logout: async (user, req) => {
        return logActivity({
            userId: user._id,
            userName: getUserFullName(user),
            userEmail: user.email,
            userRole: user.role?.roleName || user.role || 'User',
            userAvatar: user.profileimage || user.avatar,
            userEmployeeId: user.employeeid,
            action: 'logout',
            description: 'User logged out of the system',
            details: 'Session ended successfully',
            module: 'Authentication',
            status: 'success',
            severity: 'info',
            req
        });
    },

    // User status change with admin employee ID
    userStatusChange: async (adminEmployeeId, targetUser, newStatus, req) => {
        return logActivity({
            userId: 'system',
            userName: 'System Administrator',
            userEmail: 'admin@skanray.com',
            userRole: 'Admin',
            userAvatar: 'SA',
            action: newStatus === 'Active' ? 'account_activate' : 'account_deactivate',
            description: `User account ${newStatus === 'Active' ? 'activated' : 'deactivated'}`,
            details: `${newStatus === 'Active' ? 'Activated' : 'Deactivated'} user: ${getUserFullName(targetUser)} (${targetUser.employeeid})`,
            module: 'User Management',
            status: 'success',
            severity: newStatus === 'Active' ? 'info' : 'warning',
            relatedId: targetUser._id?.toString() || '',
            relatedModel: 'User',
            metadata: {
                previousStatus: targetUser.status,
                newStatus: newStatus,
                targetUser: {
                    employeeId: targetUser.employeeid,
                    email: targetUser.email,
                    name: getUserFullName(targetUser)
                }
            },
            req,
            adminEmployeeId
        });
    },

    // Device removal with admin employee ID
    deviceRemove: async (adminEmployeeId, targetUser, req) => {
        return logActivity({
            userId: 'system',
            userName: 'System Administrator',
            userEmail: 'admin@skanray.com',
            userRole: 'Admin',
            userAvatar: 'SA',
            action: 'device_remove',
            description: 'User device registration cleared',
            details: `Cleared device registration for user: ${getUserFullName(targetUser)} (${targetUser.employeeid})`,
            module: 'Device Management',
            status: 'success',
            severity: 'warning',
            relatedId: targetUser._id?.toString() || '',
            relatedModel: 'User',
            metadata: {
                clearedDeviceId: targetUser.deviceid,
                clearedDate: targetUser.deviceregistereddate,
                targetUser: {
                    employeeId: targetUser.employeeid,
                    email: targetUser.email,
                    name: getUserFullName(targetUser)
                }
            },
            req,
            adminEmployeeId
        });
    },

    // Equipment create log
    equipmentCreate: async (user, equipment, req) => {
        return logActivity({
            userId: user._id,
            userName: getUserFullName(user),
            userEmail: user.email,
            userRole: user.role?.roleName || user.role || 'User',
            userAvatar: user.profileimage || user.avatar,
            userEmployeeId: user.employeeid,
            action: 'create',
            description: 'Created new equipment record',
            details: `Equipment: ${equipment.equipmentId || equipment.name}, Type: ${equipment.type}, Model: ${equipment.model}`,
            module: 'Equipment Management',
            status: 'success',
            severity: 'info',
            relatedId: equipment._id?.toString() || '',
            relatedModel: 'Equipment',
            metadata: { equipmentType: equipment.type, model: equipment.model },
            req
        });
    },

    // Equipment update log
    equipmentUpdate: async (user, equipment, changes, req) => {
        return logActivity({
            userId: user._id,
            userName: getUserFullName(user),
            userEmail: user.email,
            userRole: user.role?.roleName || user.role || 'User',
            userAvatar: user.profileimage || user.avatar,
            userEmployeeId: user.employeeid,
            action: 'update',
            description: 'Updated equipment record',
            details: `Equipment: ${equipment.equipmentId}, Updated: ${Object.keys(changes).join(', ')}`,
            module: 'Equipment Management',
            status: 'success',
            severity: 'info',
            relatedId: equipment._id?.toString() || '',
            relatedModel: 'Equipment',
            metadata: { changes },
            req
        });
    },

    // Error log
    error: async (user, error, module, req) => {
        return logActivity({
            userId: user?._id || 'system',
            userName: user ? getUserFullName(user) : 'System',
            userEmail: user?.email || 'system@skanray.com',
            userRole: user?.role?.roleName || user?.role || 'System',
            userAvatar: user?.profileimage || user?.avatar,
            userEmployeeId: user?.employeeid || 'SYSTEM',
            action: 'error',
            description: 'System error occurred',
            details: error.message || 'Unknown error',
            module: module || 'System',
            status: 'error',
            severity: 'high',
            metadata: {
                errorName: error.name,
                errorCode: error.code,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            req
        });
    }
};

// ===== Your existing routes remain the same =====
// GET /api/activity-logs
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            action = '',
            user = '',
            module = '',
            status = '',
            dateRange = '',
            startDate,
            endDate
        } = req.query;

        const filter = {};

        if (search && search !== '') {
            filter.$or = [
                { description: { $regex: search, $options: 'i' } },
                { 'user.name': { $regex: search, $options: 'i' } },
                { module: { $regex: search, $options: 'i' } },
                { details: { $regex: search, $options: 'i' } }
            ];
        }

        if (action && action !== 'all' && action !== '') {
            filter.action = action;
        }

        if (user && user !== 'all' && user !== '') {
            filter['user.name'] = user;
        }

        if (module && module !== 'all' && module !== '') {
            filter.module = module;
        }

        if (status && status !== 'all' && status !== '') {
            filter.status = status;
        }

        if (dateRange && dateRange !== 'all') {
            const now = new Date();
            let filterStartDate = new Date();

            switch (dateRange) {
                case 'today':
                    filterStartDate.setHours(0, 0, 0, 0);
                    filter.timestamp = { $gte: filterStartDate };
                    break;
                case 'week':
                    filterStartDate.setDate(now.getDate() - 7);
                    filter.timestamp = { $gte: filterStartDate };
                    break;
                case 'month':
                    filterStartDate.setMonth(now.getMonth() - 1);
                    filter.timestamp = { $gte: filterStartDate };
                    break;
            }
        } else if (startDate && endDate) {
            filter.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate + 'T23:59:59.999Z')
            };
        }

        const totalLogs = await ActivityLog.countDocuments(filter);

        const logs = await ActivityLog.find(filter)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        const [uniqueActions, uniqueUsers, uniqueModules] = await Promise.all([
            ActivityLog.distinct('action'),
            ActivityLog.distinct('user.name'),
            ActivityLog.distinct('module')
        ]);

        const stats = await ActivityLog.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
                    errorCount: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
                    warningCount: { $sum: { $cond: [{ $eq: ['$status', 'warning'] }, 1, 0] } },
                    criticalCount: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        { $eq: ['$severity', 'high'] },
                                        { $eq: ['$severity', 'critical'] },
                                        { $eq: ['$status', 'error'] }
                                    ]
                                }, 1, 0
                            ]
                        }
                    }
                }
            }
        ]);

        const statsData = stats[0] || {
            total: 0, successCount: 0, errorCount: 0, warningCount: 0, criticalCount: 0
        };

        const uniqueUsersCount = await ActivityLog.distinct('user.id');

        res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalLogs / parseInt(limit)),
                    totalLogs,
                    hasNextPage: parseInt(page) * parseInt(limit) < totalLogs,
                    hasPrevPage: parseInt(page) > 1,
                    limit: parseInt(limit)
                },
                filters: {
                    uniqueActions: uniqueActions.sort(),
                    uniqueUsers: uniqueUsers.sort(),
                    uniqueModules: uniqueModules.sort()
                },
                stats: {
                    ...statsData,
                    activeUsers: uniqueUsersCount.length,
                    successRate: statsData.total > 0
                        ? Math.round((statsData.successCount / statsData.total) * 100)
                        : 0
                }
            }
        });

    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activity logs',
            error: error.message
        });
    }
});

// GET /api/activity-logs/stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await ActivityLog.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
                    errorCount: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
                    warningCount: { $sum: { $cond: [{ $eq: ['$status', 'warning'] }, 1, 0] } },
                    criticalCount: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        { $eq: ['$severity', 'high'] },
                                        { $eq: ['$severity', 'critical'] },
                                        { $eq: ['$status', 'error'] }
                                    ]
                                }, 1, 0
                            ]
                        }
                    }
                }
            }
        ]);

        const uniqueUsers = await ActivityLog.distinct('user.id');
        const statsData = stats[0] || {
            total: 0, successCount: 0, errorCount: 0, warningCount: 0, criticalCount: 0
        };

        res.json({
            success: true,
            data: {
                ...statsData,
                activeUsers: uniqueUsers.length,
                successRate: statsData.total > 0
                    ? Math.round((statsData.successCount / statsData.total) * 100)
                    : 0
            }
        });

    } catch (error) {
        console.error('Get activity stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activity statistics',
            error: error.message
        });
    }
});

// POST /api/activity-logs
router.post('/', async (req, res) => {
    try {
        const logEntry = await logActivity(req.body);

        if (logEntry) {
            res.json({
                success: true,
                message: 'Activity logged successfully',
                data: logEntry
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to create activity log'
            });
        }

    } catch (error) {
        console.error('Create activity log error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create activity log',
            error: error.message
        });
    }
});

// Export all functions
router.logActivity = logActivity;
router.logUserActivity = logUserActivity; // Main universal function
router.quickLog = quickLog;
router.ActivityLog = ActivityLog;
router.getUserFullName = getUserFullName;
router.getAdminByEmployeeId = getAdminByEmployeeId;

module.exports = router;
