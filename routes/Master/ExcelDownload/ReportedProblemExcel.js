const express = require('express');
const ExcelJS = require('exceljs');
const ReportedProblem = require('../../../Model/MasterSchema/ReportedProblemSchema'); 
const router = express.Router();

// Updated ReportedProblem Excel export with filters and search support
router.get('/export-reportedproblems', async (req, res) => {
    try {
        let query = {};
        
        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query = {
                $or: [
                    { catalog: searchRegex },
                    { codegroup: searchRegex },
                    { prodgroup: searchRegex },
                    { name: searchRegex },
                    { shorttextforcode: searchRegex },
                    { status: searchRegex }
                ]
            };
        }
        // Check if it's a filter export
        else if (Object.keys(req.query).some(key => 
            ['catalog', 'codegroup', 'prodgroup', 'name', 'shorttextforcode', 'status', 'createdStartDate', 'createdEndDate', 'modifiedStartDate', 'modifiedEndDate'].includes(key) && req.query[key]
        )) {
            // Catalog filter
            if (req.query.catalog) {
                query.catalog = req.query.catalog;
            }

            // Code Group filter
            if (req.query.codegroup) {
                query.codegroup = req.query.codegroup;
            }

            // Product Group filter
            if (req.query.prodgroup) {
                query.prodgroup = req.query.prodgroup;
            }

            // Name filter
            if (req.query.name) {
                query.name = { $regex: req.query.name, $options: 'i' };
            }

            // Short Text For Code filter
            if (req.query.shorttextforcode) {
                query.shorttextforcode = { $regex: req.query.shorttextforcode, $options: 'i' };
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

        // Fetch reported problem data with query
        const reportedProblemData = await ReportedProblem.find(query).sort({ createdAt: -1 }).lean();

        console.log('Found records:', reportedProblemData.length);

        if (!reportedProblemData || reportedProblemData.length === 0) {
            return res.status(404).json({ 
                message: 'No reported problem data found',
                query: query,
                queryParams: req.query
            });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reported Problems Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Catalog', key: 'catalog', width: 20 },
            { header: 'Code Group', key: 'codegroup', width: 18 },
            { header: 'Product Group', key: 'prodgroup', width: 18 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Short Text For Code', key: 'shorttextforcode', width: 30 },
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
        reportedProblemData.forEach((problem, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                catalog: problem.catalog || '',
                codegroup: problem.codegroup || '',
                prodgroup: problem.prodgroup || '',
                name: problem.name || '',
                shorttextforcode: problem.shorttextforcode || '',
                status: problem.status || '',
                createdAt: problem.createdAt ? new Date(problem.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: problem.modifiedAt ? new Date(problem.modifiedAt).toLocaleDateString('en-IN') : ''
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
                } else if (colNumber === 6) { // Short Text For Code column - wrap text
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if (colNumber === 7) { // Status column - center align
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };

                    // Status-based conditional formatting
                    const statusValue = cell.value;
                    if (statusValue === 'Active') {
                        cell.font = { color: { argb: '008000' }, bold: true }; // Green for Active
                    } else if (statusValue === 'Inactive') {
                        cell.font = { color: { argb: 'FF0000' }, bold: true }; // Red for Inactive
                    } else if (statusValue === 'Pending') {
                        cell.font = { color: { argb: 'FF8C00' }, bold: true }; // Orange for Pending
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
        let fileName = 'reported_problems_data';
        if (req.query.search) {
            fileName = `reported_problems_search_${req.query.search.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else if (Object.keys(req.query).some(key => 
            ['catalog', 'codegroup', 'prodgroup', 'name', 'shorttextforcode', 'status'].includes(key) && req.query[key]
        )) {
            fileName = 'reported_problems_filtered';
        }
        fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('ReportedProblem Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting reported problem data to Excel',
            error: error.message,
            query: req.query
        });
    }
});

module.exports = router;
