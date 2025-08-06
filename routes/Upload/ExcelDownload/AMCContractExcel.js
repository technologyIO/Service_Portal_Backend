const express = require('express');
const ExcelJS = require('exceljs');
const AMCContract = require('../../../Model/UploadSchema/AMCContractSchema');
const router = express.Router();

// AMCContract Excel export API - Clean version
router.get('/export-amccontracts', async (req, res) => {
    try {
        // Sabhi AMC contract records fetch kariye
        const amcContractData = await AMCContract.find({}).lean();

        if (!amcContractData || amcContractData.length === 0) {
            return res.status(404).json({ message: 'No AMC contract data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('AMC Contracts Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Sales Doc', key: 'salesdoc', width: 18 },
            { header: 'Start Date', key: 'startdate', width: 15 },
            { header: 'End Date', key: 'enddate', width: 15 },
            { header: 'SA Type (ZDRC/ZDRN)', key: 'satypeZDRC_ZDRN', width: 20 },
            { header: 'Serial Number', key: 'serialnumber', width: 20 },
            { header: 'Material Code', key: 'materialcode', width: 18 },
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
        amcContractData.forEach((contract, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                salesdoc: contract.salesdoc || '',
                startdate: contract.startdate ? new Date(contract.startdate).toLocaleDateString('en-IN') : '',
                enddate: contract.enddate ? new Date(contract.enddate).toLocaleDateString('en-IN') : '',
                satypeZDRC_ZDRN: contract.satypeZDRC_ZDRN || '',
                serialnumber: contract.serialnumber || '',
                materialcode: contract.materialcode || '',
                status: contract.status || '',
                createdAt: contract.createdAt ? new Date(contract.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: contract.modifiedAt ? new Date(contract.modifiedAt).toLocaleDateString('en-IN') : ''
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

                // Center align S.No and Date columns
                if (colNumber === 1 || colNumber === 3 || colNumber === 4) {
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
        const fileName = `amc_contracts_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('AMCContract Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting AMC contract data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
