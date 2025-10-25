const express = require('express');
const ExcelJS = require('exceljs');
const moment = require('moment');
const DealerStock = require('../../../Model/UploadSchema/DealerStockSchema');
const router = express.Router();

// Updated DealerStock Excel export with filters and search support
router.get('/export-dealerstock', async (req, res) => {
    try {
        let query = {};
        
        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            const isNumeric = !isNaN(req.query.search);
            
            query = {
                $or: [
                    { dealercodeid: searchRegex },
                    { dealername: searchRegex },
                    { dealercity: searchRegex },
                    { materialcode: searchRegex },
                    { materialdescription: searchRegex },
                    { plant: searchRegex },
                    ...(isNumeric ? [{ unrestrictedquantity: Number(req.query.search) }] : []),
                    { status: searchRegex }
                ]
            };
        }
        // Check if it's a filter export
        else if (Object.keys(req.query).some(key => 
            ['dealercodeid', 'dealername', 'dealercity', 'materialcode', 'materialdescription', 'plant', 'unrestrictedquantity', 'quantityMin', 'quantityMax', 'status', 'createdStartDate', 'createdEndDate', 'modifiedStartDate', 'modifiedEndDate'].includes(key) && req.query[key]
        )) {
            if (req.query.dealercodeid) {
                query.dealercodeid = req.query.dealercodeid;
            }
            if (req.query.dealername) {
                query.dealername = req.query.dealername;
            }
            if (req.query.dealercity) {
                query.dealercity = req.query.dealercity;
            }
            if (req.query.materialcode) {
                query.materialcode = req.query.materialcode;
            }
            if (req.query.materialdescription) {
                query.materialdescription = { $regex: req.query.materialdescription, $options: 'i' };
            }
            if (req.query.plant) {
                query.plant = req.query.plant;
            }
            if (req.query.unrestrictedquantity) {
                query.unrestrictedquantity = Number(req.query.unrestrictedquantity);
            }
            if (req.query.quantityMin || req.query.quantityMax) {
                query.unrestrictedquantity = {};
                if (req.query.quantityMin) {
                    query.unrestrictedquantity.$gte = Number(req.query.quantityMin);
                }
                if (req.query.quantityMax) {
                    query.unrestrictedquantity.$lte = Number(req.query.quantityMax);
                }
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
                query.modifiedAt = {};
                if (req.query.modifiedStartDate) {
                    query.modifiedAt.$gte = new Date(req.query.modifiedStartDate);
                }
                if (req.query.modifiedEndDate) {
                    const endDate = new Date(req.query.modifiedEndDate);
                    endDate.setHours(23, 59, 59, 999);
                    query.modifiedAt.$lte = endDate;
                }
            }
        }

        console.log('Excel Export Query:', query);

        // Fetch dealer stock data with query
        const dealerStockData = await DealerStock.find(query).sort({ createdAt: -1 }).lean();

        console.log('Found records:', dealerStockData.length);

        if (!dealerStockData || dealerStockData.length === 0) {
            return res.status(404).json({ 
                message: 'No dealer stock data found',
                query: query,
                queryParams: req.query
            });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Dealer Stock Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Dealer Code ID', key: 'dealercodeid', width: 18 },
            { header: 'Dealer Name', key: 'dealername', width: 25 },
            { header: 'Dealer City', key: 'dealercity', width: 18 },
            { header: 'Material Code', key: 'materialcode', width: 18 },
            { header: 'Material Description', key: 'materialdescription', width: 35 },
            { header: 'Plant', key: 'plant', width: 15 },
            { header: 'Unrestricted Quantity', key: 'unrestrictedquantity', width: 20 },
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

        // ✅ FIXED DATE HANDLING - Data rows add kariye
        dealerStockData.forEach((stock, index) => {
            // ✅ Enhanced date formatting function
            const formatDateForExcel = (dateValue) => {
                if (!dateValue) return '';
                try {
                    const date = new Date(dateValue);
                    if (isNaN(date.getTime())) return '';
                    
                    return moment(date).format('DD-MM-YYYY');
                } catch (error) {
                    console.log('Date formatting error:', error);
                    return '';
                }
            };

            const getStatus = (status) => {
                return status || 'Active';
            };

            // Add row with proper formatting
            const row = worksheet.addRow({
                sno: index + 1,
                dealercodeid: stock.dealercodeid || '',
                dealername: stock.dealername || '',
                dealercity: stock.dealercity || '',
                materialcode: stock.materialcode || '',
                materialdescription: stock.materialdescription || '',
                plant: stock.plant || '',
                unrestrictedquantity: stock.unrestrictedquantity || 0,
                status: getStatus(stock.status),
                createdAt: formatDateForExcel(stock.createdAt),
                modifiedAt: formatDateForExcel(stock.modifiedAt)
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
                if (colNumber === 1 || colNumber === 8) { // S.No and Quantity
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (colNumber === 6) { // Material Description
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if (colNumber === 9) { // Status column
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
                } else if (colNumber === 10 || colNumber === 11) { // Date columns
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (cell.value && cell.value.trim() !== '') {
                        cell.font = { color: { argb: '0066CC' } };
                    }
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }

                // Quantity column formatting
                if (colNumber === 8 && cell.value !== '') {
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
        let fileName = 'dealer_stock_data';
        if (req.query.search) {
            fileName = `dealer_stock_search_${req.query.search.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else if (Object.keys(req.query).some(key => 
            ['dealercodeid', 'dealername', 'dealercity', 'materialcode', 'materialdescription', 'plant', 'unrestrictedquantity', 'quantityMin', 'quantityMax', 'status'].includes(key) && req.query[key]
        )) {
            fileName = 'dealer_stock_filtered';
        }
        fileName += `_${moment().format('DD-MM-YYYY')}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('DealerStock Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting dealer stock data to Excel',
            error: error.message,
            query: req.query
        });
    }
});

module.exports = router;
