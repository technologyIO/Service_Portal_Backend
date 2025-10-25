const express = require('express');
const ExcelJS = require('exceljs');
const ServiceCharge = require('../../../Model/AdminSchema/ServiceChargeSchema'); 
const router = express.Router();

// ServiceCharge Excel export API - Clean version
router.get('/export-servicecharges', async (req, res) => {
    try {
        // Sabhi service charge records fetch kariye
        const serviceChargeData = await ServiceCharge.find({}).lean();

        if (!serviceChargeData || serviceChargeData.length === 0) {
            return res.status(404).json({ message: 'No service charge data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Service Charges Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Part Number', key: 'partNumber', width: 18 },
            { header: 'Description', key: 'description', width: 35 },
            { header: 'Product', key: 'Product', width: 25 },
            { header: 'CMC Price', key: 'cmcPrice', width: 15 },
            { header: 'NCMC Price', key: 'ncmcPrice', width: 15 },
            { header: 'Within City Charge', key: 'withinCityCharge', width: 18 },
            { header: 'Outside City Charge', key: 'outsideCityCharge', width: 18 },
            { header: 'Remarks', key: 'remarks', width: 30 }
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
        serviceChargeData.forEach((serviceCharge, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                partNumber: serviceCharge.partNumber || '',
                description: serviceCharge.description || '',
                Product: serviceCharge.Product || '',
                cmcPrice: serviceCharge.cmcPrice || 0,
                ncmcPrice: serviceCharge.ncmcPrice || 0,
                withinCityCharge: serviceCharge.onCallVisitCharge?.withinCity || 0,
                outsideCityCharge: serviceCharge.onCallVisitCharge?.outsideCity || 0,
                remarks: serviceCharge.remarks || ''
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
                } else if (colNumber === 3 || colNumber === 9) { // Description and Remarks - wrap text
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if (colNumber >= 5 && colNumber <= 8) { // Price columns - right align and currency format
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
        const fileName = `service_charges_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('ServiceCharge Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting service charge data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
