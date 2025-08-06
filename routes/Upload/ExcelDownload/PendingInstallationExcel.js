const express = require('express');
const ExcelJS = require('exceljs');
const PendingInstallation = require('../../../Model/UploadSchema/PendingInstallationSchema'); 
const router = express.Router();

// PendingInstallation Excel export API - Clean version
router.get('/export-pendinginstallations', async (req, res) => {
    try {
        // Sabhi pending installation records fetch kariye
        const pendingInstallationData = await PendingInstallation.find({}).lean();

        if (!pendingInstallationData || pendingInstallationData.length === 0) {
            return res.status(404).json({ message: 'No pending installation data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Pending Installations Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Invoice No', key: 'invoiceno', width: 18 },
            { header: 'Invoice Date', key: 'invoicedate', width: 15 },
            { header: 'Distribution Channel', key: 'distchnl', width: 20 },
            { header: 'Customer ID', key: 'customerid', width: 18 },
            { header: 'Customer Name 1', key: 'customername1', width: 25 },
            { header: 'Customer Name 2', key: 'customername2', width: 25 },
            { header: 'Customer City', key: 'customercity', width: 18 },
            { header: 'Customer Postal Code', key: 'customerpostalcode', width: 18 },
            { header: 'Customer Country', key: 'customercountry', width: 18 },
            { header: 'Customer Region', key: 'customerregion', width: 18 },
            { header: 'Material', key: 'material', width: 18 },
            { header: 'Description', key: 'description', width: 35 },
            { header: 'Serial Number', key: 'serialnumber', width: 20 },
            { header: 'Sales District', key: 'salesdist', width: 18 },
            { header: 'Sales Office', key: 'salesoff', width: 18 },
            { header: 'Current Customer ID', key: 'currentcustomerid', width: 20 },
            { header: 'Current Customer Name 1', key: 'currentcustomername1', width: 25 },
            { header: 'Current Customer Name 2', key: 'currentcustomername2', width: 25 },
            { header: 'Current Customer City', key: 'currentcustomercity', width: 20 },
            { header: 'Current Customer Region', key: 'currentcustomerregion', width: 20 },
            { header: 'Current Customer Postal Code', key: 'currentcustomerpostalcode', width: 22 },
            { header: 'Current Customer Country', key: 'currentcustomercountry', width: 20 },
            { header: 'Material Group 4', key: 'mtl_grp4', width: 18 },
            { header: 'Key', key: 'key', width: 15 },
            { header: 'PAL Number', key: 'palnumber', width: 18 },
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
        pendingInstallationData.forEach((installation, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                invoiceno: installation.invoiceno || '',
                invoicedate: installation.invoicedate ? new Date(installation.invoicedate).toLocaleDateString('en-IN') : '',
                distchnl: installation.distchnl || '',
                customerid: installation.customerid || '',
                customername1: installation.customername1 || '',
                customername2: installation.customername2 || '',
                customercity: installation.customercity || '',
                customerpostalcode: installation.customerpostalcode || '',
                customercountry: installation.customercountry || '',
                customerregion: installation.customerregion || '',
                material: installation.material || '',
                description: installation.description || '',
                serialnumber: installation.serialnumber || '',
                salesdist: installation.salesdist || '',
                salesoff: installation.salesoff || '',
                currentcustomerid: installation.currentcustomerid || '',
                currentcustomername1: installation.currentcustomername1 || '',
                currentcustomername2: installation.currentcustomername2 || '',
                currentcustomercity: installation.currentcustomercity || '',
                currentcustomerregion: installation.currentcustomerregion || '',
                currentcustomerpostalcode: installation.currentcustomerpostalcode || '',
                currentcustomercountry: installation.currentcustomercountry || '',
                mtl_grp4: installation.mtl_grp4 || '',
                key: installation.key || '',
                palnumber: installation.palnumber || '',
                status: installation.status || '',
                createdAt: installation.createdAt ? new Date(installation.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: installation.modifiedAt ? new Date(installation.modifiedAt).toLocaleDateString('en-IN') : ''
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

                // Center align S.No and Invoice Date columns
                if (colNumber === 1 || colNumber === 3) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (colNumber === 13) { // Description column - wrap text
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
        const fileName = `pending_installations_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('PendingInstallation Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting pending installation data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
