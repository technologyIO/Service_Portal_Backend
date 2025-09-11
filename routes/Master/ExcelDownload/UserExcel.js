const express = require('express');
const ExcelJS = require('exceljs');
const User = require('../../../Model/MasterSchema/UserSchema');
const router = express.Router();
// GET filter options for dropdowns
router.get('/filter-options', async (req, res) => {
    try {
        const users = await User.find({}, {
            'role.roleName': 1,
            department: 1,
            demographics: 1,
            branch: 1
        });

        const roles = [...new Set(users.map(u => u.role?.roleName).filter(Boolean))];
        const departments = [...new Set(users.map(u => u.department).filter(Boolean))];

        const countries = [...new Set(users.flatMap(u =>
            u.demographics?.find(d => d.type === 'country')?.values?.map(v => v.name) || []
        ))];

        const states = [...new Set(users.flatMap(u =>
            u.demographics?.find(d => d.type === 'state')?.values?.map(v => v.name) || []
        ))];

        const cities = [...new Set(users.flatMap(u =>
            u.demographics?.find(d => d.type === 'city')?.values?.map(v => v.name) || []
        ))];

        const branches = [...new Set(users.flatMap(u =>
            u.demographics?.find(d => d.type === 'branch')?.values?.map(v => v.name) || u.branch || []
        ))];

        res.json({
            roles: roles.sort(),
            departments: departments.sort(),
            countries: countries.sort(),
            states: states.sort(),
            cities: cities.sort(),
            branches: branches.sort()
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET users with filters
router.get('/filter', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filters = {};

        // Status filter
        if (req.query.status) {
            filters.status = req.query.status;
        }

        // Date range filter
        if (req.query.startDate || req.query.endDate) {
            filters.createdAt = {};
            if (req.query.startDate) {
                filters.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                const endDate = new Date(req.query.endDate);
                endDate.setHours(23, 59, 59, 999); // End of day
                filters.createdAt.$lte = endDate;
            }
        }

        // Role filter
        if (req.query.role) {
            filters['role.roleName'] = req.query.role;
        }

        // User type filter
        if (req.query.usertype) {
            filters.usertype = req.query.usertype;
        }

        // Department filter
        if (req.query.department) {
            filters.department = req.query.department;
        }

        // Demographics filters
        const demographicFilters = [];

        if (req.query.country) {
            demographicFilters.push({
                'demographics': {
                    $elemMatch: {
                        'type': 'country',
                        'values.name': req.query.country
                    }
                }
            });
        }

        if (req.query.state) {
            demographicFilters.push({
                'demographics': {
                    $elemMatch: {
                        'type': 'state',
                        'values.name': req.query.state
                    }
                }
            });
        }

        if (req.query.city) {
            demographicFilters.push({
                'demographics': {
                    $elemMatch: {
                        'type': 'city',
                        'values.name': req.query.city
                    }
                }
            });
        }

        if (req.query.branch) {
            demographicFilters.push({
                $or: [
                    {
                        'demographics': {
                            $elemMatch: {
                                'type': 'branch',
                                'values.name': req.query.branch
                            }
                        }
                    },
                    {
                        'branch': req.query.branch
                    }
                ]
            });
        }

        // Combine all filters
        let finalFilter = filters;
        if (demographicFilters.length > 0) {
            finalFilter = {
                $and: [
                    filters,
                    ...demographicFilters
                ]
            };
        }

        const users = await User.find(finalFilter, { password: 0 })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const totalUsers = await User.countDocuments(finalFilter);
        const totalPages = Math.ceil(totalUsers / limit);

        res.json({
            users,
            totalPages,
            totalUsers,
            currentPage: page,
            filters: req.query
        });
    } catch (err) {
        console.error('Filter error:', err);
        res.status(500).json({ message: err.message });
    }
});
// Excel export API
router.get('/export-users', async (req, res) => {
    try {
        let query = {};

        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query = {
                $or: [
                    { firstname: searchRegex },
                    { lastname: searchRegex },
                    { email: searchRegex },
                    { employeeid: searchRegex },
                    { mobilenumber: searchRegex },
                    { department: searchRegex },
                    { 'role.roleName': searchRegex }
                ]
            };
        }
        // Check if it's a filter export
        else {
            // Status filter
            if (req.query.status) {
                query.status = req.query.status;
            }

            // Date range filter
            if (req.query.startDate || req.query.endDate) {
                query.createdAt = {};
                if (req.query.startDate) {
                    query.createdAt.$gte = new Date(req.query.startDate);
                }
                if (req.query.endDate) {
                    const endDate = new Date(req.query.endDate);
                    endDate.setHours(23, 59, 59, 999);
                    query.createdAt.$lte = endDate;
                }
            }

            // Role filter
            if (req.query.role) {
                query['role.roleName'] = req.query.role;
            }

            // User type filter
            if (req.query.usertype) {
                query.usertype = req.query.usertype;
            }

            // Department filter
            if (req.query.department) {
                query.department = req.query.department;
            }

            // Demographics filters
            const demographicFilters = [];

            if (req.query.country) {
                demographicFilters.push({
                    'demographics': {
                        $elemMatch: {
                            'type': 'country',
                            'values.name': req.query.country
                        }
                    }
                });
            }

            if (req.query.state) {
                demographicFilters.push({
                    'demographics': {
                        $elemMatch: {
                            'type': 'state',
                            'values.name': req.query.state
                        }
                    }
                });
            }

            if (req.query.city) {
                demographicFilters.push({
                    'demographics': {
                        $elemMatch: {
                            'type': 'city',
                            'values.name': req.query.city
                        }
                    }
                });
            }

            if (req.query.branch) {
                demographicFilters.push({
                    $or: [
                        {
                            'demographics': {
                                $elemMatch: {
                                    'type': 'branch',
                                    'values.name': req.query.branch
                                }
                            }
                        },
                        {
                            'branch': req.query.branch
                        }
                    ]
                });
            }

            // Combine filters if demographics exist
            if (demographicFilters.length > 0) {
                query = {
                    $and: [
                        query,
                        ...demographicFilters
                    ]
                };
            }
        }

        const users = await User.find(query, { password: 0 }).sort({ createdAt: -1 });

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users');

        // Define columns
        worksheet.columns = [
            { header: 'Employee ID', key: 'employeeid', width: 15 },
            { header: 'First Name', key: 'firstname', width: 15 },
            { header: 'Last Name', key: 'lastname', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Mobile Number', key: 'mobilenumber', width: 15 },
            { header: 'Status', key: 'status', width: 10 },
            { header: 'User Type', key: 'usertype', width: 12 },
            { header: 'Role', key: 'role', width: 15 },
            { header: 'Department', key: 'department', width: 15 },
            { header: 'Manager Email', key: 'manageremail', width: 25 },
            { header: 'Dealer Name', key: 'dealerName', width: 20 },
            { header: 'Country', key: 'country', width: 15 },
            { header: 'State', key: 'state', width: 15 },
            { header: 'City', key: 'city', width: 15 },
            { header: 'Branch', key: 'branch', width: 15 },
            { header: 'Skills Count', key: 'skillsCount', width: 12 },
            { header: 'Device ID', key: 'deviceid', width: 20 },
            { header: 'Created Date', key: 'createdAt', width: 15 },
            { header: 'Login Expiry', key: 'loginexpirydate', width: 15 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6F3FF' }
        };

        // Add data rows
        users.forEach(user => {
            const getDemographicValue = (type) => {
                const demo = user.demographics?.find(d => d.type === type);
                return demo?.values?.map(v => v.name).join(', ') || '';
            };

            worksheet.addRow({
                employeeid: user.employeeid || '',
                firstname: user.firstname || '',
                lastname: user.lastname || '',
                email: user.email || '',
                mobilenumber: user.mobilenumber || '',
                status: user.status || '',
                usertype: user.usertype || '',
                role: user.role?.roleName || '',
                department: user.department || '',
                manageremail: user.manageremail?.join(', ') || '',
                dealerName: user.dealerInfo?.dealerName || '',
                country: getDemographicValue('country'),
                state: getDemographicValue('state'),
                city: getDemographicValue('city'),
                branch: getDemographicValue('branch') || user.branch?.join(', ') || '',
                skillsCount: user.skills?.length || 0,
                deviceid: user.deviceid || '',
                createdAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '',
                loginexpirydate: user.loginexpirydate ? new Date(user.loginexpirydate).toLocaleDateString() : ''
            });
        });

        // Set response headers for file download
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=users_export_${new Date().toISOString().split('T')[0]}.xlsx`
        );

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting users to Excel',
            error: error.message
        });
    }
});
router.get('/usersearch', async (req, res) => {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

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

        const users = await User.find(query, { password: 0 }).skip(skip).limit(limit);
        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);

        res.json({
            users,
            totalPages,
            totalUsers,
            currentPage: page,
            isSearch: true
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// Add these routes to your existing userRoutes.js file




module.exports = router;
