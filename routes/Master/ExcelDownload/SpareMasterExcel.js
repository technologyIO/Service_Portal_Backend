const express = require('express');
const ExcelJS = require('exceljs');
const SpareMaster = require('../../../Model/MasterSchema/SpareMasterSchema'); 
const router = express.Router();

// SpareMaster Excel export API
router.get('/export-sparemaster', async (req, res) => {
    try {
        // Sabhi spare master records fetch kariye
        const spareMasterData = await SpareMaster.find({}).lean();

        if (!spareMasterData || spareMasterData.length === 0) {
            return res.status(404).json({ message: 'No spare master data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Spare Master Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Sub Group', key: 'Sub_grp', width: 20 },
            { header: 'Part Number', key: 'PartNumber', width: 20 },
            { header: 'Description', key: 'Description', width: 35 },
            { header: 'Type', key: 'Type', width: 15 },
            { header: 'Rate (MRP)', key: 'Rate', width: 15 },
            { header: 'DP (Dealer Price)', key: 'DP', width: 18 },
            { header: 'Charges (Exchange Price)', key: 'Charges', width: 22 },
            { header: 'Spare Image URL', key: 'spareiamegUrl', width: 30 },
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
        spareMasterData.forEach((spare, index) => {
            // Charges field ko safely handle kariye (Mixed type hai)
            const chargesValue = spare.Charges !== null && spare.Charges !== undefined 
                ? (typeof spare.Charges === 'object' ? JSON.stringify(spare.Charges) : spare.Charges.toString())
                : '';

            const row = worksheet.addRow({
                sno: index + 1,
                Sub_grp: spare.Sub_grp || '',
                PartNumber: spare.PartNumber || '',
                Description: spare.Description || '',
                Type: spare.Type || '',
                Rate: spare.Rate || '',
                DP: spare.DP || '',
                Charges: chargesValue,
                spareiamegUrl: spare.spareiamegUrl || '',
                createdAt: spare.createdAt ? new Date(spare.createdAt).toLocaleDateString('en-IN') : '',
                updatedAt: spare.updatedAt ? new Date(spare.updatedAt).toLocaleDateString('en-IN') : ''
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
                } else if (colNumber === 4) { // Description column - wrap text
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if (colNumber === 9) { // Image URL column - wrap text
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if ([6, 7, 8].includes(colNumber)) { // Price columns - right align
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
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
        const fileName = `spare_master_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('SpareMaster Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting spare master data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
