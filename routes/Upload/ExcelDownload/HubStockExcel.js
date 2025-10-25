const express = require('express');
const ExcelJS = require('exceljs');
const moment = require('moment'); 
const HubStock = require('../../../Model/UploadSchema/HubStockSchema'); 
const router = express.Router();

// Updated HubStock Excel export with FIXED date and status handling
router.get('/export-hubstock', async (req, res) => {
    try {
        let query = {};
        
        // Search export logic
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            const isNumeric = !isNaN(req.query.search);
            
            query = {
                $or: [
                    { materialcode: searchRegex },
                    { materialdescription: searchRegex },
                    ...(isNumeric ? [{ quantity: Number(req.query.search) }] : []),
                    { storagelocation: searchRegex },
                    { status: searchRegex }
                ]
            };
        }
        // Filter export logic
        else if (Object.keys(req.query).some(key => 
            ['materialcode', 'materialdescription', 'quantity', 'quantityMin', 'quantityMax', 'storagelocation', 'status', 'createdStartDate', 'createdEndDate', 'modifiedStartDate', 'modifiedEndDate'].includes(key) && req.query[key]
        )) {
            if (req.query.materialcode) {
                query.materialcode = req.query.materialcode;
            }
            if (req.query.materialdescription) {
                query.materialdescription = { $regex: req.query.materialdescription, $options: 'i' };
            }
            if (req.query.quantity) {
                query.quantity = Number(req.query.quantity);
            }
            if (req.query.quantityMin || req.query.quantityMax) {
                query.quantity = {};
                if (req.query.quantityMin) {
                    query.quantity.$gte = Number(req.query.quantityMin);
                }
                if (req.query.quantityMax) {
                    query.quantity.$lte = Number(req.query.quantityMax);
                }
            }
            if (req.query.storagelocation) {
                query.storagelocation = req.query.storagelocation;
            }
            // ✅ FIXED: Status filter in Excel export
            if (req.query.status) {
                query.status = new RegExp(`^${req.query.status}$`, 'i');
            }
            if (req.query.createdStartDate || req.query.createdEndDate) {
                query.createdAt = {};
                if (req.query.createdStartDate) {
                    query.createdAt.$gte = new Date(req.query.createdStartDate);
                }
                if (req.query.createdEndDate) {
                    const endDate = new Date(req.query.createdEndDate);
                    endDate.setHours(23, 59, 59, 999);
                    query.createdAt.$lte = endDate;
                }
            }
            if (req.query.modifiedStartDate || req.query.modifiedEndDate) {
                query.updatedAt = {};
                if (req.query.modifiedStartDate) {
                    query.updatedAt.$gte = new Date(req.query.modifiedStartDate);
                }
                if (req.query.modifiedEndDate) {
                    const endDate = new Date(req.query.modifiedEndDate);
                    endDate.setHours(23, 59, 59, 999);
                    query.updatedAt.$lte = endDate;
                }
            }
        }

        console.log('Excel Export Query:', query);

        // Fetch hub stock data with query
        const hubStockData = await HubStock.find(query).sort({ createdAt: -1 }).lean();

        console.log('Found records:', hubStockData.length);

        if (!hubStockData || hubStockData.length === 0) {
            return res.status(404).json({ 
                message: 'No hub stock data found',
                query: query,
                queryParams: req.query
            });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Hub Stock Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Material Code', key: 'materialcode', width: 18 },
            { header: 'Material Description', key: 'materialdescription', width: 35 },
            { header: 'Quantity', key: 'quantity', width: 12 },
            { header: 'Storage Location', key: 'storagelocation', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
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

        // ✅ FIXED DATE HANDLING - Data rows add kariye
        hubStockData.forEach((stock, index) => {
            // ✅ Enhanced date formatting function
            const formatDateForExcel = (dateValue) => {
                if (!dateValue) return '';
                try {
                    // Ensure we have a valid date
                    const date = new Date(dateValue);
                    if (isNaN(date.getTime())) return '';
                    
                    // Return formatted string instead of Date object to avoid timezone issues
                    return moment(date).format('DD-MM-YYYY');
                } catch (error) {
                    console.log('Date formatting error:', error);
                    return '';
                }
            };

            // ✅ Helper function to get proper status
            const getStatus = (status) => {
                return status || 'Active';
            };

            // Add row with proper formatting
            const row = worksheet.addRow({
                sno: index + 1,
                materialcode: stock.materialcode || '',
                materialdescription: stock.materialdescription || '',
                quantity: stock.quantity || 0,
                storagelocation: stock.storagelocation || '',
                status: getStatus(stock.status),
                createdAt: formatDateForExcel(stock.createdAt), // ✅ Use formatted string
                updatedAt: formatDateForExcel(stock.updatedAt)  // ✅ Use formatted string
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

                // Specific column alignments and formatting
                if (colNumber === 1 || colNumber === 4) { // S.No and Quantity
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (colNumber === 3) { // Material Description
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if (colNumber === 6) { // Status column
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    
                    const statusValue = cell.value;
                    if (statusValue === 'Active') {
                        cell.font = { color: { argb: '008000' }, bold: true };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'E8F5E8' }
                        };
                    } else if (statusValue === 'Inactive') {
                        cell.font = { color: { argb: 'FF0000' }, bold: true };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFE8E8' }
                        };
                    } else if (statusValue === 'Pending') {
                        cell.font = { color: { argb: 'FF8C00' }, bold: true };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF4E8' }
                        };
                    }
                } else if (colNumber === 7 || colNumber === 8) { // Date columns
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (cell.value && cell.value.trim() !== '') {
                        cell.font = { color: { argb: '0066CC' } };
                    }
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }

                // Quantity column formatting
                if (colNumber === 4 && cell.value !== '') {
                    cell.numFmt = '#,##0';
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    cell.font = { color: { argb: '000080' }, bold: true };
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

        // Set response headers for file download
        let fileName = 'hub_stock_data';
        if (req.query.search) {
            fileName = `hub_stock_search_${req.query.search.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else if (Object.keys(req.query).some(key => 
            ['materialcode', 'materialdescription', 'quantity', 'quantityMin', 'quantityMax', 'storagelocation', 'status'].includes(key) && req.query[key]
        )) {
            fileName = 'hub_stock_filtered';
        }
        fileName += `_${moment().format('DD-MM-YYYY')}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('HubStock Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting hub stock data to Excel',
            error: error.message,
            query: req.query
        });
    }
});

module.exports = router;
