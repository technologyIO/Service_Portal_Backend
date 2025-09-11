const express = require('express');
const ExcelJS = require('exceljs');
const ComplaintType = require('../../../Model/ComplaintSchema/ComplaintTypeSchema'); 
const router = express.Router();

// Updated ComplaintType Excel export with filters and search support
router.get('/export-complainttypes', async (req, res) => {
    try {
        let query = {};
        
        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query = {
                $or: [
                    { name: searchRegex },
                    { status: { $regex: req.query.search, $options: 'i' } }
                ]
            };
            
            // If search is boolean-like, convert and search explicitly by status
            if (req.query.search.toLowerCase() === 'true' || req.query.search.toLowerCase() === 'false') {
                query.$or.push({ status: req.query.search.toLowerCase() === 'true' });
            }
        }
        // Check if it's a filter export
        else if (Object.keys(req.query).some(key => 
            ['status', 'createdStartDate', 'createdEndDate', 'modifiedStartDate', 'modifiedEndDate'].includes(key) && req.query[key]
        )) {
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
        console.log('Request Query Params:', req.query);

        // Fetch complaint type data with query
        const complaintTypeData = await ComplaintType.find(query).sort({ createdAt: -1 }).lean();

        console.log('Found records:', complaintTypeData.length);

        if (!complaintTypeData || complaintTypeData.length === 0) {
            return res.status(404).json({ 
                message: 'No complaint type data found',
                query: query,
                queryParams: req.query
            });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Complaint Types Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Complaint Type Name', key: 'name', width: 30 },
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
        complaintTypeData.forEach((complaintType, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                name: complaintType.name || '',
                status: complaintType.status || '',
                createdAt: complaintType.createdAt ? new Date(complaintType.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: complaintType.modifiedAt ? new Date(complaintType.modifiedAt).toLocaleDateString('en-IN') : ''
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

        // Set response headers for file download
        let fileName = 'complaint_types_data';
        if (req.query.search) {
            fileName = `complaint_types_search_${req.query.search.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else if (Object.keys(req.query).some(key => 
            ['status', 'createdStartDate', 'createdEndDate', 'modifiedStartDate', 'modifiedEndDate'].includes(key) && req.query[key]
        )) {
            fileName = 'complaint_types_filtered';
        }
        fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('ComplaintType Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting complaint type data to Excel',
            error: error.message,
            query: req.query
        });
    }
});

module.exports = router;
