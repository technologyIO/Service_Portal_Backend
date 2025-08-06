const express = require('express');
const ExcelJS = require('exceljs');
const WarrantyCode = require('../../../Model/MasterSchema/WarrantyCodeSchema'); 
const router = express.Router();

// WarrantyCode Excel export API
router.get('/export-warrantycodes', async (req, res) => {
    try {
        // Sabhi warranty code records fetch kariye
        const warrantyCodeData = await WarrantyCode.find({}).lean();

        if (!warrantyCodeData || warrantyCodeData.length === 0) {
            return res.status(404).json({ message: 'No warranty code data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Warranty Codes Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Warranty Code ID', key: 'warrantycodeid', width: 20 },
            { header: 'Description', key: 'description', width: 35 },
            { header: 'Months', key: 'months', width: 12 },
            { header: 'Status', key: 'status', width: 12 },
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
        warrantyCodeData.forEach((warrantyCode, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                warrantycodeid: warrantyCode.warrantycodeid || '',
                description: warrantyCode.description || '',
                months: warrantyCode.months || '',
                status: warrantyCode.status || '',
                createdAt: warrantyCode.createdAt ? new Date(warrantyCode.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: warrantyCode.modifiedAt ? new Date(warrantyCode.modifiedAt).toLocaleDateString('en-IN') : ''
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

                // Center align S.No and Months columns
                if (colNumber === 1 || colNumber === 4) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (colNumber === 3) { // Description column - wrap text
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
        const fileName = `warranty_codes_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('WarrantyCode Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting warranty code data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
