const express = require('express');
const ExcelJS = require('exceljs');
const User = require('../../../Model/MasterSchema/UserSchema');
const router = express.Router();

// Excel export API
router.get('/export-users', async (req, res) => {
    try {
        // Sabhi users fetch kariye
        const users = await User.find({}).lean();

        if (!users || users.length === 0) {
            return res.status(404).json({ message: 'No users found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'First Name', key: 'firstname', width: 15 },
            { header: 'Last Name', key: 'lastname', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Mobile Number', key: 'mobilenumber', width: 15 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'User Type', key: 'usertype', width: 12 },
            { header: 'Employee ID', key: 'employeeid', width: 15 },
            { header: 'Department', key: 'department', width: 15 },
            { header: 'Manager Emails', key: 'manageremail', width: 30 },
            { header: 'Zip Code', key: 'zipCode', width: 12 },
            { header: 'Role Name', key: 'roleName', width: 15 },
            { header: 'Role ID', key: 'roleId', width: 15 },
            { header: 'Dealer Name', key: 'dealerName', width: 20 },
            { header: 'Dealer ID', key: 'dealerId', width: 15 },
            { header: 'Dealer Email', key: 'dealerEmail', width: 25 },
            { header: 'Dealer Code', key: 'dealerCode', width: 15 },
            { header: 'Skills', key: 'skills', width: 40 },
            { header: 'Demographics', key: 'demographics', width: 40 },
            { header: 'Branch', key: 'branch', width: 20 },
            { header: 'Location', key: 'location', width: 20 },
            { header: 'Created At', key: 'createdAt', width: 18 },
            { header: 'Modified At', key: 'modifiedAt', width: 18 },
            { header: 'Login Expiry Date', key: 'loginexpirydate', width: 18 },
            { header: 'Device ID', key: 'deviceid', width: 15 },
            { header: 'Device Registered Date', key: 'deviceregistereddate', width: 20 }
        ];

        // Header row styling
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '4472C4' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Data rows add kariye
        users.forEach((user, index) => {
            // Skills format kariye
            const skillsText = user.skills && user.skills.length > 0
                ? user.skills.map(skill =>
                    `Product: ${skill.productName || 'N/A'}, Parts: ${skill.partNumbers ? skill.partNumbers.join(', ') : 'N/A'}, Group: ${skill.productGroup || 'N/A'}`
                ).join(' | ')
                : 'No skills';

            // Demographics format kariye
            const demographicsText = user.demographics && user.demographics.length > 0
                ? user.demographics.map(demo => {
                    const values = demo.values && demo.values.length > 0
                        ? demo.values.map(v => `${v.name || v.id || 'N/A'}`).join(', ')
                        : 'No values';
                    return `Type: ${demo.type}, Selection: ${demo.selectionType}, Values: ${values}`;
                }).join(' | ')
                : 'No demographics';

            const row = worksheet.addRow({
                sno: index + 1,
                firstname: user.firstname || '',
                lastname: user.lastname || '',
                email: user.email || '',
                mobilenumber: user.mobilenumber || '',
                status: user.status || '',
                usertype: user.usertype || '',
                employeeid: user.employeeid || '',
                department: user.department || '',
                manageremail: user.manageremail ? user.manageremail.join(', ') : '',
                zipCode: user.zipCode || '',
                roleName: user.role ? user.role.roleName || '' : '',
                roleId: user.role ? user.role.roleId || '' : '',
                dealerName: user.dealerInfo ? user.dealerInfo.dealerName || '' : '',
                dealerId: user.dealerInfo ? user.dealerInfo.dealerId || '' : '',
                dealerEmail: user.dealerInfo ? user.dealerInfo.dealerEmail || '' : '',
                dealerCode: user.dealerInfo ? user.dealerInfo.dealerCode || '' : '',
                skills: skillsText,
                demographics: demographicsText,
                branch: user.branch ? user.branch.join(', ') : '',
                location: user.location ? user.location.join(', ') : '',
                createdAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: user.modifiedAt ? new Date(user.modifiedAt).toLocaleDateString('en-IN') : '',
                loginexpirydate: user.loginexpirydate ? new Date(user.loginexpirydate).toLocaleDateString('en-IN') : '',
                deviceid: user.deviceid || '',
                deviceregistereddate: user.deviceregistereddate ? new Date(user.deviceregistereddate).toLocaleDateString('en-IN') : ''
            });

            // Row styling
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Response headers set kariye
        const fileName = `users_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
