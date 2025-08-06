const express = require('express');
const ExcelJS = require('exceljs');
const PendingComplaints = require('../../../Model/UploadSchema/PendingCompliantsSchema'); 
const router = express.Router();

// PendingComplaints Excel export API - Clean version
router.get('/export-pendingcomplaints', async (req, res) => {
    try {
        // Sabhi pending complaints records fetch kariye
        const pendingComplaintsData = await PendingComplaints.find({}).lean();

        if (!pendingComplaintsData || pendingComplaintsData.length === 0) {
            return res.status(404).json({ message: 'No pending complaints data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Pending Complaints Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Notification Type', key: 'notificationtype', width: 18 },
            { header: 'Complaint ID', key: 'notification_complaintid', width: 20 },
            { header: 'Notification Date', key: 'notificationdate', width: 18 },
            { header: 'User Status', key: 'userstatus', width: 15 },
            { header: 'Material Description', key: 'materialdescription', width: 30 },
            { header: 'Serial Number', key: 'serialnumber', width: 18 },
            { header: 'Device Data', key: 'devicedata', width: 20 },
            { header: 'Sales Office', key: 'salesoffice', width: 18 },
            { header: 'Material Code', key: 'materialcode', width: 18 },
            { header: 'Reported Problem', key: 'reportedproblem', width: 25 },
            { header: 'Dealer Code', key: 'dealercode', width: 15 },
            { header: 'Customer Code', key: 'customercode', width: 18 },
            { header: 'Partner Response', key: 'partnerresp', width: 20 },
            { header: 'Breakdown', key: 'breakdown', width: 15 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Product Group', key: 'productgroup', width: 18 },
            { header: 'Problem Type', key: 'problemtype', width: 18 },
            { header: 'Problem Name', key: 'problemname', width: 20 },
            { header: 'Spare Request', key: 'sparerequest', width: 20 },
            { header: 'Remark', key: 'remark', width: 30 },
            { header: 'Request Update', key: 'requesteupdate', width: 15 },
            { header: 'Created At', key: 'createdAt', width: 18 },
            { header: 'Modified At', key: 'modifiedAt', width: 18 }
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
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Data rows add kariye
        pendingComplaintsData.forEach((complaint, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                notificationtype: complaint.notificationtype || '',
                notification_complaintid: complaint.notification_complaintid || '',
                notificationdate: complaint.notificationdate || '',
                userstatus: complaint.userstatus || '',
                materialdescription: complaint.materialdescription || '',
                serialnumber: complaint.serialnumber || '',
                devicedata: complaint.devicedata || '',
                salesoffice: complaint.salesoffice || '',
                materialcode: complaint.materialcode || '',
                reportedproblem: complaint.reportedproblem || '',
                dealercode: complaint.dealercode || '',
                customercode: complaint.customercode || '',
                partnerresp: complaint.partnerresp || '',
                breakdown: complaint.breakdown || '',
                status: complaint.status || '',
                productgroup: complaint.productgroup || '',
                problemtype: complaint.problemtype || '',
                problemname: complaint.problemname || '',
                sparerequest: complaint.sparerequest || '',
                remark: complaint.remark || '',
                requesteupdate: complaint.requesteupdate ? 'Yes' : 'No',
                createdAt: complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: complaint.modifiedAt ? new Date(complaint.modifiedAt).toLocaleDateString('en-IN') : ''
            });

            // Basic row styling
            row.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                // Alternate row coloring
                if ((index + 2) % 2 === 0) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'F8F9FA' }
                    };
                }

                // Center align S.No and Request Update columns
                if (colNumber === 1 || colNumber === 22) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (colNumber === 6 || colNumber === 21) { // Material Description and Remark - wrap text
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
            });
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength > 50 ? 50 : maxLength + 2;
        });

        // Response headers set kariye
        const fileName = `pending_complaints_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('PendingComplaints Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting pending complaints data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
