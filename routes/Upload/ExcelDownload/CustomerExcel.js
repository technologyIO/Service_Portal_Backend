const express = require('express');
const ExcelJS = require('exceljs');
const Customer = require('../../../Model/UploadSchema/CustomerSchema');
const router = express.Router();

// Optimized Customer Excel export with styling
router.get('/export-customers', async (req, res) => {
    // Set response headers immediately
    const fileName = `customers_data_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    try {
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
            { header: 'State', key: 'state', width: 15 },
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

        // Get cursor for streaming data
        const cursor = Customer.find().lean().cursor();
        let rowCount = 0;
        const batchSize = 500; // Process in batches

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
                state: customer.state || '',
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