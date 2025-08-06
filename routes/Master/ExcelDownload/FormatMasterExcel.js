const express = require('express');
const ExcelJS = require('exceljs');
const FormatMaster = require('../../../Model/MasterSchema/FormatMasterSchema'); 
const router = express.Router();

// FormatMaster Excel export API
router.get('/export-formatmaster', async (req, res) => {
    try {
        // Sabhi format master records fetch kariye
        const formatMasterData = await FormatMaster.find({}).lean();

        if (!formatMasterData || formatMasterData.length === 0) {
            return res.status(404).json({ message: 'No format master data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Format Master Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Product Group', key: 'productGroup', width: 20 },
            { header: 'CHL No', key: 'chlNo', width: 15 },
            { header: 'Rev No', key: 'revNo', width: 12 },
            { header: 'Type', key: 'type', width: 20 },
            { header: 'Status', key: 'status', width: 12 },
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
        formatMasterData.forEach((format, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                productGroup: format.productGroup || '',
                chlNo: format.chlNo || '',
                revNo: format.revNo || '',
                type: format.type || '',
                status: format.status || '',
                createdAt: format.createdAt ? new Date(format.createdAt).toLocaleDateString('en-IN') : '',
                updatedAt: format.updatedAt ? new Date(format.updatedAt).toLocaleDateString('en-IN') : ''
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

                // Center align S.No and Rev No columns
                if (colNumber === 1 || colNumber === 4) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
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
        const fileName = `format_master_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('FormatMaster Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting format master data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
