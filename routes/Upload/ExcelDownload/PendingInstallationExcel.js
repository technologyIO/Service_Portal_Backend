const express = require('express');
const ExcelJS = require('exceljs');
const moment = require('moment');
const PendingInstallation = require('../../../Model/UploadSchema/PendingInstallationSchema');
const router = express.Router();

// Updated PendingInstallation Excel export with filters and search support
router.get('/export-pendinginstallations', async (req, res) => {
    try {
        let query = {};
        
        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            
            query = {
                $or: [
                    { invoiceno: searchRegex },
                    { distchnl: searchRegex },
                    { customerid: searchRegex },
                    { customername1: searchRegex },
                    { customername2: searchRegex },
                    { customercity: searchRegex },
                    { customerpostalcode: searchRegex },
                    { material: searchRegex },
                    { description: searchRegex },
                    { serialnumber: searchRegex },
                    { salesdist: searchRegex },
                    { salesoff: searchRegex },
                    { customercountry: searchRegex },
                    { customerregion: searchRegex },
                    { currentcustomerid: searchRegex },
                    { currentcustomername1: searchRegex },
                    { currentcustomername2: searchRegex },
                    { currentcustomercity: searchRegex },
                    { currentcustomerregion: searchRegex },
                    { currentcustomerpostalcode: searchRegex },
                    { currentcustomercountry: searchRegex },
                    { mtl_grp4: searchRegex },
                    { palnumber: searchRegex },
                    { key: searchRegex },
                    { status: searchRegex }
                ]
            };
        }
        // Check if it's a filter export
        else if (Object.keys(req.query).some(key => 
            ['invoiceno', 'distchnl', 'customerid', 'customername1', 'customercity', 'material', 'description', 'serialnumber', 'salesdist', 'salesoff', 'customercountry', 'palnumber', 'status', 'invoiceDateFrom', 'invoiceDateTo', 'createdStartDate', 'createdEndDate', 'modifiedStartDate', 'modifiedEndDate'].includes(key) && req.query[key]
        )) {
            if (req.query.invoiceno) {
                query.invoiceno = { $regex: req.query.invoiceno, $options: 'i' };
            }
            if (req.query.distchnl) {
                query.distchnl = req.query.distchnl;
            }
            if (req.query.customerid) {
                query.customerid = { $regex: req.query.customerid, $options: 'i' };
            }
            if (req.query.customername1) {
                query.customername1 = { $regex: req.query.customername1, $options: 'i' };
            }
            if (req.query.customercity) {
                query.customercity = req.query.customercity;
            }
            if (req.query.material) {
                query.material = req.query.material;
            }
            if (req.query.description) {
                query.description = { $regex: req.query.description, $options: 'i' };
            }
            if (req.query.serialnumber) {
                query.serialnumber = { $regex: req.query.serialnumber, $options: 'i' };
            }
            if (req.query.salesdist) {
                query.salesdist = req.query.salesdist;
            }
            if (req.query.salesoff) {
                query.salesoff = req.query.salesoff;
            }
            if (req.query.customercountry) {
                query.customercountry = req.query.customercountry;
            }
            if (req.query.palnumber) {
                query.palnumber = { $regex: req.query.palnumber, $options: 'i' };
            }
            // ✅ FIXED: Status filter in Excel export
            if (req.query.status) {
                query.status = new RegExp(`^${req.query.status}$`, 'i');
            }
            if (req.query.invoiceDateFrom || req.query.invoiceDateTo) {
                query.invoicedate = {};
                if (req.query.invoiceDateFrom) {
                    query.invoicedate.$gte = new Date(req.query.invoiceDateFrom);
                }
                if (req.query.invoiceDateTo) {
                    const endDate = new Date(req.query.invoiceDateTo);
                    endDate.setHours(23, 59, 59, 999);
                    query.invoicedate.$lte = endDate;
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

        // Fetch pending installation data with query
        const pendingInstallationData = await PendingInstallation.find(query).sort({ createdAt: -1 }).lean();

        console.log('Found records:', pendingInstallationData.length);

        if (!pendingInstallationData || pendingInstallationData.length === 0) {
            return res.status(404).json({ 
                message: 'No pending installation data found',
                query: query,
                queryParams: req.query
            });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Pending Installations Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Invoice No', key: 'invoiceno', width: 18 },
            { header: 'Invoice Date', key: 'invoicedate', width: 15 },
            { header: 'Distribution Channel', key: 'distchnl', width: 20 },
            { header: 'Customer ID', key: 'customerid', width: 18 },
            { header: 'Customer Name 1', key: 'customername1', width: 25 },
            { header: 'Customer Name 2', key: 'customername2', width: 25 },
            { header: 'Customer City', key: 'customercity', width: 18 },
            { header: 'Customer Postal Code', key: 'customerpostalcode', width: 18 },
            { header: 'Customer Country', key: 'customercountry', width: 18 },
            { header: 'Customer Region', key: 'customerregion', width: 18 },
            { header: 'Material', key: 'material', width: 18 },
            { header: 'Description', key: 'description', width: 35 },
            { header: 'Serial Number', key: 'serialnumber', width: 20 },
            { header: 'Sales District', key: 'salesdist', width: 18 },
            { header: 'Sales Office', key: 'salesoff', width: 18 },
            { header: 'Current Customer ID', key: 'currentcustomerid', width: 20 },
            { header: 'Current Customer Name 1', key: 'currentcustomername1', width: 25 },
            { header: 'Current Customer Name 2', key: 'currentcustomername2', width: 25 },
            { header: 'Current Customer City', key: 'currentcustomercity', width: 20 },
            { header: 'Current Customer Region', key: 'currentcustomerregion', width: 20 },
            { header: 'Current Customer Postal Code', key: 'currentcustomerpostalcode', width: 22 },
            { header: 'Current Customer Country', key: 'currentcustomercountry', width: 20 },
            { header: 'Material Group 4', key: 'mtl_grp4', width: 18 },
            { header: 'Key', key: 'key', width: 15 },
            { header: 'PAL Number', key: 'palnumber', width: 18 },
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
        pendingInstallationData.forEach((installation, index) => {
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
                invoiceno: installation.invoiceno || '',
                invoicedate: formatDateForExcel(installation.invoicedate),
                distchnl: installation.distchnl || '',
                customerid: installation.customerid || '',
                customername1: installation.customername1 || '',
                customername2: installation.customername2 || '',
                customercity: installation.customercity || '',
                customerpostalcode: installation.customerpostalcode || '',
                customercountry: installation.customercountry || '',
                customerregion: installation.customerregion || '',
                material: installation.material || '',
                description: installation.description || '',
                serialnumber: installation.serialnumber || '',
                salesdist: installation.salesdist || '',
                salesoff: installation.salesoff || '',
                currentcustomerid: installation.currentcustomerid || '',
                currentcustomername1: installation.currentcustomername1 || '',
                currentcustomername2: installation.currentcustomername2 || '',
                currentcustomercity: installation.currentcustomercity || '',
                currentcustomerregion: installation.currentcustomerregion || '',
                currentcustomerpostalcode: installation.currentcustomerpostalcode || '',
                currentcustomercountry: installation.currentcustomercountry || '',
                mtl_grp4: installation.mtl_grp4 || '',
                key: installation.key || '',
                palnumber: installation.palnumber || '',
                status: getStatus(installation.status),
                createdAt: formatDateForExcel(installation.createdAt),
                modifiedAt: formatDateForExcel(installation.modifiedAt)
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
                } else if (colNumber === 3) { // Invoice Date
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (cell.value && cell.value.trim() !== '') {
                        cell.font = { color: { argb: '0066CC' } };
                    }
                } else if (colNumber === 13) { // Description column
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if (colNumber === 27) { // Status column
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
                } else if (colNumber === 28 || colNumber === 29) { // Created/Modified Date columns
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
        let fileName = 'pending_installations_data';
        if (req.query.search) {
            fileName = `pending_installations_search_${req.query.search.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else if (Object.keys(req.query).some(key => 
            ['invoiceno', 'distchnl', 'customerid', 'customername1', 'customercity', 'material', 'description', 'serialnumber', 'salesdist', 'salesoff', 'customercountry', 'palnumber', 'status'].includes(key) && req.query[key]
        )) {
            fileName = 'pending_installations_filtered';
        }
        fileName += `_${moment().format('DD-MM-YYYY')}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('PendingInstallation Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting pending installation data to Excel',
            error: error.message,
            query: req.query
        });
    }
});

module.exports = router;
