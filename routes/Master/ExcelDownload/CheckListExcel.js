const express = require('express');
const ExcelJS = require('exceljs');
const CheckList = require('../../../Model/CollectionSchema/ChecklistSchema'); 
const router = express.Router();

// Updated CheckList Excel export with proper search and filter support
router.get('/export-checklists', async (req, res) => {
    try {
        let query = {};
        
        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query = {
                $or: [
                    { checklisttype: searchRegex },
                    { status: searchRegex },
                    { checkpointtype: searchRegex },
                    { checkpoint: searchRegex },
                    { prodGroup: searchRegex },
                    { result: searchRegex },
                    { resulttype: searchRegex }
                ]
            };
        }
        // Check if it's a filter export
        else if (Object.keys(req.query).some(key => 
            ['status', 'checklistType', 'checkpointType', 'productGroup', 'resultType', 'startDate', 'endDate', 'startVoltageMin', 'startVoltageMax', 'endVoltageMin', 'endVoltageMax'].includes(key) && req.query[key]
        )) {
            // Status filter
            if (req.query.status) {
                query.status = req.query.status;
            }

            // Checklist type filter
            if (req.query.checklistType) {
                query.checklisttype = req.query.checklistType;
            }

            // Checkpoint type filter 
            if (req.query.checkpointType) {
                query.checkpointtype = req.query.checkpointType;
            }

            // Product group filter
            if (req.query.productGroup) {
                query.prodGroup = req.query.productGroup;
            }

            // Result type filter
            if (req.query.resultType) {
                query.resulttype = req.query.resultType;
            }

            // Created date range filter
            if (req.query.startDate || req.query.endDate) {
                query.createdAt = {};
                if (req.query.startDate) {
                    query.createdAt.$gte = new Date(req.query.startDate);
                }
                if (req.query.endDate) {
                    const endDate = new Date(req.query.endDate);
                    endDate.setHours(23, 59, 59, 999);
                    query.createdAt.$lte = endDate;
                }
            }

            // Start voltage range filter
            if (req.query.startVoltageMin || req.query.startVoltageMax) {
                query.startVoltage = {};
                if (req.query.startVoltageMin) {
                    query.startVoltage.$gte = req.query.startVoltageMin;
                }
                if (req.query.startVoltageMax) {
                    query.startVoltage.$lte = req.query.startVoltageMax;
                }
            }

            // End voltage range filter
            if (req.query.endVoltageMin || req.query.endVoltageMax) {
                query.endVoltage = {};
                if (req.query.endVoltageMin) {
                    query.endVoltage.$gte = req.query.endVoltageMin;
                }
                if (req.query.endVoltageMax) {
                    query.endVoltage.$lte = req.query.endVoltageMax;
                }
            }
        }

        console.log('Excel Export Query:', query); // Debug log
        console.log('Request Query Params:', req.query); // Debug log

        // Fetch checklist data with query
        const checklistData = await CheckList.find(query).sort({ createdAt: -1 }).lean();

        console.log('Found records:', checklistData.length); // Debug log

        if (!checklistData || checklistData.length === 0) {
            return res.status(404).json({ 
                message: 'No checklist data found',
                query: query,
                queryParams: req.query
            });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('CheckLists Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Checklist Type', key: 'checklisttype', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Checkpoint Type', key: 'checkpointtype', width: 20 },
            { header: 'Checkpoint', key: 'checkpoint', width: 30 },
            { header: 'Product Group', key: 'prodGroup', width: 18 },
            { header: 'Result', key: 'result', width: 20 },
            { header: 'Result Type', key: 'resulttype', width: 18 },
            { header: 'Start Voltage', key: 'startVoltage', width: 15 },
            { header: 'End Voltage', key: 'endVoltage', width: 15 },
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
        checklistData.forEach((checklist, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                checklisttype: checklist.checklisttype || '',
                status: checklist.status || '',
                checkpointtype: checklist.checkpointtype || '',
                checkpoint: checklist.checkpoint || '',
                prodGroup: checklist.prodGroup || '',
                result: checklist.result || '',
                resulttype: checklist.resulttype || '',
                startVoltage: checklist.startVoltage || '',
                endVoltage: checklist.endVoltage || '',
                createdAt: checklist.createdAt ? new Date(checklist.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: checklist.modifiedAt ? new Date(checklist.modifiedAt).toLocaleDateString('en-IN') : ''
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
                } else if (colNumber === 5) { // Checkpoint column - wrap text for long content
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

        // Set response headers for file download
        let fileName = 'checklists_data';
        if (req.query.search) {
            fileName = `checklists_search_${req.query.search.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else if (Object.keys(req.query).some(key => 
            ['status', 'checklistType', 'checkpointType', 'productGroup', 'resultType', 'startDate', 'endDate'].includes(key) && req.query[key]
        )) {
            fileName = 'checklists_filtered';
        }
        fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('CheckList Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting checklist data to Excel',
            error: error.message,
            query: req.query
        });
    }
});

module.exports = router;
