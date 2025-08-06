const express = require('express');
const ExcelJS = require('exceljs');
const Product = require('../../../Model/MasterSchema/ProductSchema'); // Apna correct path daaliye
const router = express.Router();

// Product Excel export API
router.get('/export-products', async (req, res) => {
    try {
        // Sabhi product records fetch kariye
        const productData = await Product.find({}).lean();

        if (!productData || productData.length === 0) {
            return res.status(404).json({ message: 'No product data found' });
        }

        // Nyi Excel workbook banayiye
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Products Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Product Group', key: 'productgroup', width: 20 },
            { header: 'Part No ID', key: 'partnoid', width: 18 },
            { header: 'Product', key: 'product', width: 25 },
            { header: 'Sub Group', key: 'subgrp', width: 18 },
            { header: 'Frequency', key: 'frequency', width: 15 },
            { header: 'Date of Launch', key: 'dateoflaunch', width: 18 },
            { header: 'End of Sale Date', key: 'endofsaledate', width: 18 },
            { header: 'End of Support Date', key: 'endofsupportdate', width: 20 },
            { header: 'Ex Support Available', key: 'exsupportavlb', width: 20 },
            { header: 'Installation Checklist Status', key: 'installationcheckliststatusboolean', width: 30 },
            { header: 'PM Checklist Status', key: 'pmcheckliststatusboolean', width: 25 },
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
        productData.forEach((product, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                productgroup: product.productgroup || '',
                partnoid: product.partnoid || '',
                product: product.product || '',
                subgrp: product.subgrp || '',
                frequency: product.frequency || '',
                dateoflaunch: product.dateoflaunch ? new Date(product.dateoflaunch).toLocaleDateString('en-IN') : '',
                endofsaledate: product.endofsaledate ? new Date(product.endofsaledate).toLocaleDateString('en-IN') : '',
                endofsupportdate: product.endofsupportdate ? new Date(product.endofsupportdate).toLocaleDateString('en-IN') : '',
                exsupportavlb: product.exsupportavlb ? new Date(product.exsupportavlb).toLocaleDateString('en-IN') : '',
                installationcheckliststatusboolean: product.installationcheckliststatusboolean || '',
                pmcheckliststatusboolean: product.pmcheckliststatusboolean || '',
                createdAt: product.createdAt ? new Date(product.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: product.modifiedAt ? new Date(product.modifiedAt).toLocaleDateString('en-IN') : ''
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
        const fileName = `products_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Product Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting product data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
