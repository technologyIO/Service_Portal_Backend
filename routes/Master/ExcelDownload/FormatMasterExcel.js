const express = require('express');
const ExcelJS = require('exceljs');
const FormatMaster = require('../../../Model/MasterSchema/FormatMasterSchema'); 
const router = express.Router();

// Updated FormatMaster Excel export with filters and search support
router.get('/export-formatmaster', async (req, res) => {
    try {
        let query = {};
        
        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query = {
                $or: [
                    { productGroup: searchRegex },
                    { chlNo: searchRegex },
                    { type: searchRegex },
                    { status: searchRegex }
                ]
            };
            
            // If search is a number, also search by revNo
            if (!isNaN(req.query.search)) {
                query.$or.push({ revNo: Number(req.query.search) });
            }
        }
        // Check if it's a filter export
        else if (Object.keys(req.query).some(key => 
            ['productGroup', 'chlNo', 'revNo', 'type', 'status', 'createdStartDate', 'createdEndDate', 'modifiedStartDate', 'modifiedEndDate'].includes(key) && req.query[key]
        )) {
            // Product Group filter
            if (req.query.productGroup) {
                query.productGroup = req.query.productGroup;
            }

            // CHL No filter
            if (req.query.chlNo) {
                query.chlNo = req.query.chlNo;
            }

            // Rev No filter
            if (req.query.revNo) {
                query.revNo = parseInt(req.query.revNo);
            }

            // Type filter
            if (req.query.type) {
                query.type = req.query.type;
            }

            // Status filter
            if (req.query.status) {
                query.status = req.query.status;
            }

            // Created date range filter
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

            // Modified date range filter
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
        console.log('Request Query Params:', req.query);

        // Fetch format master data with query
        const formatMasterData = await FormatMaster.find(query).sort({ createdAt: -1 }).lean();

        console.log('Found records:', formatMasterData.length);

        if (!formatMasterData || formatMasterData.length === 0) {
            return res.status(404).json({ 
                message: 'No format master data found',
                query: query,
                queryParams: req.query
            });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Format Master Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Product Group', key: 'productGroup', width: 20 },
            { header: 'CHL No', key: 'chlNo', width: 15 },
            { header: 'Rev No', key: 'revNo', width: 12 },
            { header: 'Type', key: 'type', width: 20 },
            { header: 'Status', key: 'status', width: 12 },
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
        formatMasterData.forEach((format, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                productGroup: format.productGroup || '',
                chlNo: format.chlNo || '',
                revNo: format.revNo || '',
                type: format.type || '',
                status: format.status || '',
                createdAt: format.createdAt ? new Date(format.createdAt).toLocaleDateString('en-IN') : '',
                updatedAt: format.updatedAt ? new Date(format.updatedAt).toLocaleDateString('en-IN') : ''
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

                // Center align S.No and Rev No columns
                if (colNumber === 1 || colNumber === 4) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (colNumber === 6) { // Status column - center align
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };

                    // Status-based conditional formatting
                    const statusValue = cell.value;
                    if (statusValue === 'Active') {
                        cell.font = { color: { argb: '008000' }, bold: true }; // Green for Active
                    } else if (statusValue === 'Inactive') {
                        cell.font = { color: { argb: 'FF0000' }, bold: true }; // Red for Inactive
                    } else {
                        cell.font = { color: { argb: 'FF8C00' }, bold: true }; // Orange for other statuses
                    }
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

        // Set response headers for file download
        let fileName = 'format_master_data';
        if (req.query.search) {
            fileName = `format_master_search_${req.query.search.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else if (Object.keys(req.query).some(key => 
            ['productGroup', 'chlNo', 'revNo', 'type', 'status'].includes(key) && req.query[key]
        )) {
            fileName = 'format_master_filtered';
        }
        fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('FormatMaster Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting format master data to Excel',
            error: error.message,
            query: req.query
        });
    }
});

module.exports = router;
