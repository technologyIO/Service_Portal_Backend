const express = require('express');
const ExcelJS = require('exceljs');
const moment = require('moment');
const PendingComplaints = require('../../../Model/UploadSchema/PendingCompliantsSchema');
const router = express.Router();

// Updated PendingComplaints Excel export with filters and search support
router.get('/export-pendingcomplaints', async (req, res) => {
    try {
        let query = {};
        
        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            
            query = {
                $or: [
                    { notificationtype: searchRegex },
                    { notification_complaintid: searchRegex },
                    { notificationdate: searchRegex },
                    { userstatus: searchRegex },
                    { materialdescription: searchRegex },
                    { serialnumber: searchRegex },
                    { devicedata: searchRegex },
                    { salesoffice: searchRegex },
                    { materialcode: searchRegex },
                    { reportedproblem: searchRegex },
                    { dealercode: searchRegex },
                    { customercode: searchRegex },
                    { partnerresp: searchRegex },
                    { sparerequest: searchRegex },
                    { remark: searchRegex },
                    { breakdown: searchRegex },
                    { status: searchRegex }
                ]
            };
        }
        // Check if it's a filter export
        else if (Object.keys(req.query).some(key => 
            ['notificationtype', 'notification_complaintid', 'userstatus', 'materialdescription', 'serialnumber', 'salesoffice', 'materialcode', 'dealercode', 'status', 'notificationDateFrom', 'notificationDateTo', 'createdStartDate', 'createdEndDate', 'modifiedStartDate', 'modifiedEndDate'].includes(key) && req.query[key]
        )) {
            if (req.query.notificationtype) {
                query.notificationtype = req.query.notificationtype;
            }
            if (req.query.notification_complaintid) {
                query.notification_complaintid = { $regex: req.query.notification_complaintid, $options: 'i' };
            }
            if (req.query.userstatus) {
                query.userstatus = req.query.userstatus;
            }
            if (req.query.materialdescription) {
                query.materialdescription = { $regex: req.query.materialdescription, $options: 'i' };
            }
            if (req.query.serialnumber) {
                query.serialnumber = { $regex: req.query.serialnumber, $options: 'i' };
            }
            if (req.query.salesoffice) {
                query.salesoffice = req.query.salesoffice;
            }
            if (req.query.materialcode) {
                query.materialcode = req.query.materialcode;
            }
            if (req.query.dealercode) {
                query.dealercode = req.query.dealercode;
            }
            // ✅ FIXED: Status filter in Excel export
            if (req.query.status) {
                query.status = new RegExp(`^${req.query.status}$`, 'i');
            }
            if (req.query.notificationDateFrom || req.query.notificationDateTo) {
                query.notificationdate = {};
                if (req.query.notificationDateFrom) {
                    query.notificationdate.$gte = new Date(req.query.notificationDateFrom);
                }
                if (req.query.notificationDateTo) {
                    const endDate = new Date(req.query.notificationDateTo);
                    endDate.setHours(23, 59, 59, 999);
                    query.notificationdate.$lte = endDate;
                }
            }
            if (req.query.createdStartDate || req.query.createdEndDate) {
                query.createdAt = {};
                if (req.query.createdStartDate) {
                    query.createdAt.$gte = new Date(req.query.createdStartDate);
                }
                if (req.query.createdEndDate) {
                    const endDate = new Date(req.query.createdEndDate);
                    endDate.setHours(23, 59, 59, 999);
                    query.createdAt.$lte = endDate;
                }
            }
            if (req.query.modifiedStartDate || req.query.modifiedEndDate) {
                query.modifiedAt = {};
                if (req.query.modifiedStartDate) {
                    query.modifiedAt.$gte = new Date(req.query.modifiedStartDate);
                }
                if (req.query.modifiedEndDate) {
                    const endDate = new Date(req.query.modifiedEndDate);
                    endDate.setHours(23, 59, 59, 999);
                    query.modifiedAt.$lte = endDate;
                }
            }
        }

        console.log('Excel Export Query:', query);

        // Fetch pending complaints data with query
        const pendingComplaintsData = await PendingComplaints.find(query).sort({ createdAt: -1 }).lean();

        console.log('Found records:', pendingComplaintsData.length);

        if (!pendingComplaintsData || pendingComplaintsData.length === 0) {
            return res.status(404).json({ 
                message: 'No pending complaints data found',
                query: query,
                queryParams: req.query
            });
        }

        // Create Excel workbook
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
            { header: 'Spare Request', key: 'sparerequest', width: 20 },
            { header: 'Remark', key: 'remark', width: 30 },
            { header: 'Breakdown', key: 'breakdown', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
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

        // ✅ FIXED DATE HANDLING - Data rows add kariye
        pendingComplaintsData.forEach((complaint, index) => {
            // ✅ Enhanced date formatting function
            const formatDateForExcel = (dateValue) => {
                if (!dateValue) return '';
                try {
                    const date = new Date(dateValue);
                    if (isNaN(date.getTime())) return '';
                    
                    return moment(date).format('DD-MM-YYYY');
                } catch (error) {
                    console.log('Date formatting error:', error);
                    return '';
                }
            };

            const getStatus = (status) => {
                return status || 'Active';
            };

            // Add row with proper formatting
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
                sparerequest: complaint.sparerequest || '',
                remark: complaint.remark || '',
                breakdown: complaint.breakdown || '',
                status: getStatus(complaint.status),
                createdAt: formatDateForExcel(complaint.createdAt),
                modifiedAt: formatDateForExcel(complaint.modifiedAt)
            });

            // Row styling
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

                // Specific column alignments and formatting
                if (colNumber === 1) { // S.No
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (colNumber === 6 || colNumber === 16) { // Material Description and Remark
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if (colNumber === 18) { // Status column
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    
                    const statusValue = cell.value;
                    if (statusValue === 'Active') {
                        cell.font = { color: { argb: '008000' }, bold: true };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'E8F5E8' }
                        };
                    } else if (statusValue === 'Inactive') {
                        cell.font = { color: { argb: 'FF0000' }, bold: true };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFE8E8' }
                        };
                    } else if (statusValue === 'Pending') {
                        cell.font = { color: { argb: 'FF8C00' }, bold: true };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF4E8' }
                        };
                    }
                } else if (colNumber === 19 || colNumber === 20) { // Created/Modified Date columns
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (cell.value && cell.value.trim() !== '') {
                        cell.font = { color: { argb: '0066CC' } };
                    }
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

        // Set response headers for file download
        let fileName = 'pending_complaints_data';
        if (req.query.search) {
            fileName = `pending_complaints_search_${req.query.search.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else if (Object.keys(req.query).some(key => 
            ['notificationtype', 'notification_complaintid', 'userstatus', 'materialdescription', 'serialnumber', 'salesoffice', 'materialcode', 'dealercode', 'status'].includes(key) && req.query[key]
        )) {
            fileName = 'pending_complaints_filtered';
        }
        fileName += `_${moment().format('DD-MM-YYYY')}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('PendingComplaints Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting pending complaints data to Excel',
            error: error.message,
            query: req.query
        });
    }
});

module.exports = router;
