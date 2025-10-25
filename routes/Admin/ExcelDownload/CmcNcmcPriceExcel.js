const express = require('express');
const ExcelJS = require('exceljs');
const CmcNcmcPrice = require('../../../Model/AdminSchema/CmcNcmcPriceSchema'); 
const router = express.Router();

// CmcNcmcPrice Excel export API - Clean version
router.get('/export-cmcncmcprices', async (req, res) => {
    try {
        // Sabhi CMC/NCMC price records fetch kariye
        const cmcNcmcPriceData = await CmcNcmcPrice.find({}).lean();

        if (!cmcNcmcPriceData || cmcNcmcPriceData.length === 0) {
            return res.status(404).json({ message: 'No CMC/NCMC price data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('CMC NCMC Prices Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Part Number', key: 'partNumber', width: 18 },
            { header: 'Description', key: 'description', width: 35 },
            { header: 'Product', key: 'product', width: 25 },
            { header: 'CMC Price (With GST)', key: 'cmcPriceWithGst', width: 20 },
            { header: 'NCMC Price (With GST)', key: 'ncmcPriceWithGst', width: 20 },
            { header: 'Service Tax', key: 'serviceTax', width: 15 },
            { header: 'Remarks', key: 'remarks', width: 30 },
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
        cmcNcmcPriceData.forEach((priceData, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                partNumber: priceData.partNumber || '',
                description: priceData.description || '',
                product: priceData.product || '',
                cmcPriceWithGst: priceData.cmcPriceWithGst || 0,
                ncmcPriceWithGst: priceData.ncmcPriceWithGst || 0,
                serviceTax: priceData.serviceTax || '',
                remarks: priceData.remarks || '',
                status: priceData.status || '',
                createdAt: priceData.createdAt ? new Date(priceData.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: priceData.modifiedAt ? new Date(priceData.modifiedAt).toLocaleDateString('en-IN') : ''
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
                } else if (colNumber === 3 || colNumber === 8) { // Description and Remarks - wrap text
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if (colNumber === 5 || colNumber === 6) { // Price columns - right align and currency format
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    cell.numFmt = '₹#,##0.00'; // Indian currency format
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
        const fileName = `cmc_ncmc_prices_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('CmcNcmcPrice Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting CMC/NCMC price data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
