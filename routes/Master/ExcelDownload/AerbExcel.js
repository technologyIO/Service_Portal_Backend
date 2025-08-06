const express = require('express');
const ExcelJS = require('exceljs');
const Aerb = require('../../../Model/MasterSchema/AerbSchema');
const router = express.Router();

// Aerb Excel export API
router.get('/export-aerb', async (req, res) => {
    try {
        // Sabhi aerb records fetch kariye
        const aerbData = await Aerb.find({}).lean();

        if (!aerbData || aerbData.length === 0) {
            return res.status(404).json({ message: 'No AERB data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('AERB Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Material Code', key: 'materialcode', width: 20 },
            { header: 'Material Description', key: 'materialdescription', width: 40 },
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
        aerbData.forEach((aerb, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                materialcode: aerb.materialcode || '',
                materialdescription: aerb.materialdescription || '',
                status: aerb.status || '',
                createdAt: aerb.createdAt ? new Date(aerb.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: aerb.modifiedAt ? new Date(aerb.modifiedAt).toLocaleDateString('en-IN') : ''
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

                // Center align S.No column
                if (colNumber === 1) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
            });
        });

        // Auto-fit columns (optional enhancement)
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = maxLength < 10 ? 10 : maxLength + 2;
        });

        // Response headers set kariye
        const fileName = `aerb_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('AERB Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting AERB data to Excel',
            error: error.message
        });
    }
});

// Filtered AERB export (Optional - with status filter)
router.post('/export-aerb-filtered', async (req, res) => {
    try {
        const { status, startDate, endDate } = req.body;

        // Filter query banayiye
        let query = {};

        if (status) {
            query.status = status;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Filtered data fetch kariye
        const aerbData = await Aerb.find(query).lean();

        if (!aerbData || aerbData.length === 0) {
            return res.status(404).json({ message: 'No AERB data found with given filters' });
        }

        // Same Excel generation logic as above...
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Filtered AERB Data');

        // Rest of the code same as above API
        // ... (headers, styling, data population code)

        const fileName = `filtered_aerb_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Filtered AERB Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting filtered AERB data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
