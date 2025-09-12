const express = require('express');
const ExcelJS = require('exceljs');
const Customer = require('../../../Model/UploadSchema/CustomerSchema');
const router = express.Router();

// Updated Customer Excel export with filters and search support
router.get('/export-customers', async (req, res) => {
    // Set response headers immediately
    const fileName = `customers_data_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    try {
        let query = {};
        
        // Check if it's a search export
        if (req.query.search) {
            const searchTerm = req.query.search.trim();
            const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            query.$or = [
                { customercodeid: { $regex: escaped, $options: 'i' } },
                { customername: { $regex: escaped, $options: 'i' } },
                { hospitalname: { $regex: escaped, $options: 'i' } },
                { street: { $regex: escaped, $options: 'i' } },
                { city: { $regex: escaped, $options: 'i' } },
                { postalcode: { $regex: escaped, $options: 'i' } },
                { district: { $regex: escaped, $options: 'i' } },
                { region: { $regex: escaped, $options: 'i' } },
                { country: { $regex: escaped, $options: 'i' } },
                { telephone: { $regex: escaped, $options: 'i' } },
                { taxnumber1: { $regex: escaped, $options: 'i' } },
                { taxnumber2: { $regex: escaped, $options: 'i' } },
                { email: { $regex: escaped, $options: 'i' } },
                { status: { $regex: escaped, $options: 'i' } },
                { customertype: { $regex: escaped, $options: 'i' } }
            ];
        }
        // Check if it's a filter export
        else if (Object.keys(req.query).some(key => 
            ['customercodeid', 'customername', 'hospitalname', 'street', 'city', 'postalcode', 'district', 'region', 'country', 'telephone', 'taxnumber1', 'taxnumber2', 'email', 'status', 'customertype', 'createdStartDate', 'createdEndDate', 'modifiedStartDate', 'modifiedEndDate'].includes(key) && req.query[key]
        )) {
            // Apply same filters as filter route
            if (req.query.customercodeid) {
                query.customercodeid = req.query.customercodeid;
            }
            if (req.query.customername) {
                query.customername = { $regex: req.query.customername, $options: 'i' };
            }
            if (req.query.hospitalname) {
                query.hospitalname = { $regex: req.query.hospitalname, $options: 'i' };
            }
            if (req.query.street) {
                query.street = { $regex: req.query.street, $options: 'i' };
            }
            if (req.query.city) {
                query.city = req.query.city;
            }
            if (req.query.postalcode) {
                query.postalcode = { $regex: req.query.postalcode, $options: 'i' };
            }
            if (req.query.district) {
                query.district = { $regex: req.query.district, $options: 'i' };
            }
            if (req.query.region) {
                query.region = req.query.region;
            }
            if (req.query.country) {
                query.country = req.query.country;
            }
            if (req.query.telephone) {
                query.telephone = { $regex: req.query.telephone, $options: 'i' };
            }
            if (req.query.taxnumber1) {
                query.taxnumber1 = { $regex: req.query.taxnumber1, $options: 'i' };
            }
            if (req.query.taxnumber2) {
                query.taxnumber2 = { $regex: req.query.taxnumber2, $options: 'i' };
            }
            if (req.query.email) {
                query.email = { $regex: req.query.email, $options: 'i' };
            }
            if (req.query.status) {
                query.status = req.query.status;
            }
            if (req.query.customertype) {
                query.customertype = req.query.customertype;
            }

            // Date range filters
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
        console.log('Request Query Params:', req.query);

        // Create streaming workbook with styles
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res,
            useStyles: true,
            useSharedStrings: true
        });

        const worksheet = workbook.addWorksheet('Customers Data');

        // Define styles once (reused for all cells)
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFF' } },
            fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '4472C4' }
            },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            },
            alignment: { vertical: 'middle', horizontal: 'center' }
        };

        const cellStyle = {
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            },
            alignment: { vertical: 'middle', horizontal: 'left' }
        };

        const centerAlignedStyle = {
            ...cellStyle,
            alignment: { vertical: 'middle', horizontal: 'center' }
        };

        const alternateRowStyle = {
            ...cellStyle,
            fill: {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'F8F9FA' }
            }
        };

        // Define columns
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8, style: centerAlignedStyle },
            { header: 'Customer Code ID', key: 'customercodeid', width: 20 },
            { header: 'Customer Name', key: 'customername', width: 25 },
            { header: 'Hospital Name', key: 'hospitalname', width: 25 },
            { header: 'Street', key: 'street', width: 30 },
            { header: 'City', key: 'city', width: 15 },
            { header: 'Postal Code', key: 'postalcode', width: 12, style: centerAlignedStyle },
            { header: 'District', key: 'district', width: 15 },
            { header: 'Region', key: 'region', width: 15 },
            { header: 'Country', key: 'country', width: 15 },
            { header: 'Telephone', key: 'telephone', width: 18 },
            { header: 'Tax Number 1', key: 'taxnumber1', width: 18 },
            { header: 'Tax Number 2', key: 'taxnumber2', width: 18 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Customer Type', key: 'customertype', width: 15 },
            { header: 'Created At', key: 'createdAt', width: 18 },
            { header: 'Modified At', key: 'modifiedAt', width: 18 }
        ];

        // Apply header style
        worksheet.getRow(1).eachCell((cell) => {
            cell.style = headerStyle;
        });
        worksheet.getRow(1).commit();

        // Get cursor for streaming data with query
        const cursor = Customer.find(query).lean().cursor();
        let rowCount = 0;
        const batchSize = 500;

        cursor.on('data', (customer) => {
            rowCount++;
            const isAlternateRow = (rowCount % 2) === 0;
            const rowStyle = isAlternateRow ? alternateRowStyle : cellStyle;

            const row = worksheet.addRow({
                sno: rowCount,
                customercodeid: customer.customercodeid || '',
                customername: customer.customername || '',
                hospitalname: customer.hospitalname || '',
                street: customer.street || '',
                city: customer.city || '',
                postalcode: customer.postalcode || '',
                district: customer.district || '',
                region: customer.region || '',
                country: customer.country || '',
                telephone: customer.telephone || '',
                taxnumber1: customer.taxnumber1 || '',
                taxnumber2: customer.taxnumber2 || '',
                email: customer.email || '',
                status: customer.status || '',
                customertype: customer.customertype || '',
                createdAt: customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: customer.modifiedAt ? new Date(customer.modifiedAt).toLocaleDateString('en-IN') : ''
            });

            // Apply styles in bulk
            row.eachCell((cell, colNumber) => {
                if (colNumber === 1 || colNumber === 7) {
                    cell.style = centerAlignedStyle;
                } else if (colNumber === 15) { // Status column
                    cell.style = centerAlignedStyle;
                    // Status-based conditional formatting
                    const statusValue = cell.value;
                    if (statusValue === 'Active') {
                        cell.font = { color: { argb: '008000' }, bold: true }; // Green
                    } else if (statusValue === 'Inactive') {
                        cell.font = { color: { argb: 'FF0000' }, bold: true }; // Red
                    } else if (statusValue === 'Pending') {
                        cell.font = { color: { argb: 'FF8C00' }, bold: true }; // Orange
                    }
                } else {
                    cell.style = isAlternateRow ? alternateRowStyle : cellStyle;
                }
            });

            // Commit rows in batches for better performance
            if (rowCount % batchSize === 0) {
                row.commit();
            }
        });

        cursor.on('error', (err) => {
            console.error('Database stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    message: 'Database stream error',
                    error: err.message
                });
            }
            workbook.rollback();
        });

        cursor.on('end', async () => {
            try {
                await worksheet.commit();
                await workbook.commit();
            } catch (commitErr) {
                console.error('Commit error:', commitErr);
                if (!res.headersSent) {
                    res.status(500).json({
                        message: 'Excel generation failed',
                        error: commitErr.message
                    });
                }
            }
        });

    } catch (error) {
        console.error('Customer Excel export error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                message: 'Error exporting customer data',
                error: error.message
            });
        }
    }
});

module.exports = router;
