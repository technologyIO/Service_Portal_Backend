const express = require('express');
const ExcelJS = require('exceljs');
const CmcNcmcYear = require('../../../Model/AdminSchema/CmcNcmcYearsSchema'); 
const router = express.Router();

// CmcNcmcYear Excel export API - Clean version
router.get('/export-cmcncmcyears', async (req, res) => {
    try {
        // Sabhi CMC/NCMC year records fetch kariye
        const cmcNcmcYearData = await CmcNcmcYear.find({}).lean();

        if (!cmcNcmcYearData || cmcNcmcYearData.length === 0) {
            return res.status(404).json({ message: 'No CMC/NCMC year data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('CMC NCMC Years Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Year', key: 'year', width: 15 },
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

        // Data rows add kariye
        cmcNcmcYearData.forEach((yearData, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                year: yearData.year || '',
                status: yearData.status || '',
                createdAt: yearData.createdAt ? new Date(yearData.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: yearData.modifiedAt ? new Date(yearData.modifiedAt).toLocaleDateString('en-IN') : ''
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

                // Center align S.No and Year columns
                if (colNumber === 1 || colNumber === 2) {
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
        const fileName = `cmc_ncmc_years_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('CmcNcmcYear Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting CMC/NCMC year data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
