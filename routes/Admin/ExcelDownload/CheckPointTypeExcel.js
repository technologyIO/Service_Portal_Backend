const express = require('express');
const ExcelJS = require('exceljs');
const CheckPointType = require('../../../Model/CollectionSchema/CheckPointTypeSchema'); 
const router = express.Router();

// CheckPointType Excel export API - Clean version
router.get('/export-checkpointtypes', async (req, res) => {
    try {
        // Sabhi checkpoint type records fetch kariye
        const checkpointTypeData = await CheckPointType.find({}).lean();

        if (!checkpointTypeData || checkpointTypeData.length === 0) {
            return res.status(404).json({ message: 'No checkpoint type data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('CheckPoint Types Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'CheckPoint Type Name', key: 'name', width: 30 },
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
        checkpointTypeData.forEach((checkpointType, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                name: checkpointType.name || '',
                status: checkpointType.status || '',
                createdAt: checkpointType.createdAt ? new Date(checkpointType.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: checkpointType.modifiedAt ? new Date(checkpointType.modifiedAt).toLocaleDateString('en-IN') : ''
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

                // Center align S.No column
                if (colNumber === 1) {
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
        const fileName = `checkpoint_types_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('CheckPointType Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting checkpoint type data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
