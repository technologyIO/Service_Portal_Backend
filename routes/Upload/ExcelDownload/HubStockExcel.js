const express = require('express');
const ExcelJS = require('exceljs');
const HubStock = require('../../../Model/UploadSchema/HubStockSchema'); 
const router = express.Router();

// HubStock Excel export API
router.get('/export-hubstock', async (req, res) => {
    try {
        // Sabhi hub stock records fetch kariye
        const hubStockData = await HubStock.find({}).lean();

        if (!hubStockData || hubStockData.length === 0) {
            return res.status(404).json({ message: 'No hub stock data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Hub Stock Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Material Code', key: 'materialcode', width: 18 },
            { header: 'Material Description', key: 'materialdescription', width: 35 },
            { header: 'Quantity', key: 'quantity', width: 12 },
            { header: 'Storage Location', key: 'storagelocation', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Created At', key: 'createdAt', width: 18 },
            { header: 'Updated At', key: 'updatedAt', width: 18 }
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
        hubStockData.forEach((stock, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                materialcode: stock.materialcode || '',
                materialdescription: stock.materialdescription || '',
                quantity: stock.quantity || 0,
                storagelocation: stock.storagelocation || '',
                status: stock.status || '',
                createdAt: stock.createdAt ? new Date(stock.createdAt).toLocaleDateString('en-IN') : '',
                updatedAt: stock.updatedAt ? new Date(stock.updatedAt).toLocaleDateString('en-IN') : ''
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

                // Center align S.No and Quantity columns
                if (colNumber === 1 || colNumber === 4) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (colNumber === 3) { // Material Description - wrap text
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }

                // Quantity column formatting (right align for numbers)
                if (colNumber === 4 && cell.value !== '') {
                    cell.numFmt = '#,##0'; // Number formatting with commas
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
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
        const fileName = `hub_stock_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('HubStock Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting hub stock data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
