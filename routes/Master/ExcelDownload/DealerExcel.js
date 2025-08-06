const express = require('express');
const ExcelJS = require('exceljs');
const Dealer = require('../../../Model/MasterSchema/DealerSchema'); // Apna correct path daaliye
const router = express.Router();

// Dealer Excel export API
router.get('/export-dealers', async (req, res) => {
    try {
        // Sabhi dealer records fetch kariye
        const dealerData = await Dealer.find({}).lean();

        if (!dealerData || dealerData.length === 0) {
            return res.status(404).json({ message: 'No dealer data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Dealers Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Dealer Name', key: 'name', width: 25 },
            { header: 'Dealer Code', key: 'dealercode', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Person Responsible', key: 'personresponsible', width: 40 },
            { header: 'States', key: 'state', width: 30 },
            { header: 'Cities', key: 'city', width: 30 },
            { header: 'Address', key: 'address', width: 40 },
            { header: 'Pincode', key: 'pincode', width: 12 },
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
        dealerData.forEach((dealer, index) => {
            // Person Responsible format kariye with safety check
            const personResponsibleText = dealer.personresponsible && Array.isArray(dealer.personresponsible) && dealer.personresponsible.length > 0
                ? dealer.personresponsible.map(person =>
                    `Name: ${person?.name || 'N/A'}, Employee ID: ${person?.employeeid || 'N/A'}`
                ).join(' | ')
                : 'No person assigned';

            // States format kariye with safety check
            const statesText = dealer.state && Array.isArray(dealer.state) && dealer.state.length > 0
                ? dealer.state.join(', ')
                : dealer.state
                    ? (typeof dealer.state === 'string' ? dealer.state : 'N/A')
                    : 'No states';

            // Cities format kariye with safety check
            const citiesText = dealer.city && Array.isArray(dealer.city) && dealer.city.length > 0
                ? dealer.city.join(', ')
                : dealer.city
                    ? (typeof dealer.city === 'string' ? dealer.city : 'N/A')
                    : 'No cities';

            const row = worksheet.addRow({
                sno: index + 1,
                name: dealer.name || '',
                dealercode: dealer.dealercode || '',
                email: dealer.email || '',
                status: dealer.status || '',
                personresponsible: personResponsibleText,
                state: statesText,
                city: citiesText,
                address: dealer.address || '',
                pincode: dealer.pincode || '',
                createdAt: dealer.createdAt ? new Date(dealer.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: dealer.modifiedAt ? new Date(dealer.modifiedAt).toLocaleDateString('en-IN') : ''
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
                } else if (colNumber === 6) { // Person Responsible column
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if (colNumber === 9) { // Address column
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
        const fileName = `dealers_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Dealer Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting dealer data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
