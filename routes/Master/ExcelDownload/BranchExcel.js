const express = require('express');
const ExcelJS = require('exceljs');
const Branch = require('../../../Model/CollectionSchema/BranchSchema');
const router = express.Router();
router.get("/searchbranch", async (req, res) => {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        if (!q) {
            return res.status(400).json({ message: "Query parameter is required" });
        }

        const query = {
            $or: [
                { name: { $regex: q, $options: "i" } },
                { status: { $regex: q, $options: "i" } },
                { city: { $regex: q, $options: "i" } },
                { branchShortCode: { $regex: q, $options: "i" } },
                { state: { $regex: q, $options: "i" } },
            ],
        };

        const branch = await Branch.find(query).skip(skip).limit(limit).sort({ createdAt: -1 });
        const totalBranches = await Branch.countDocuments(query);
        const totalPages = Math.ceil(totalBranches / limit);

        res.json({
            branches: branch,
            totalPages,
            totalBranches,
            currentPage: page,
            isSearch: true,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Updated Branch Excel export with filters and search support
router.get('/export-branches', async (req, res) => {
    try {
        let query = {};

        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query = {
                $or: [
                    { name: searchRegex },
                    { status: searchRegex },
                    { city: searchRegex },
                    { branchShortCode: searchRegex },
                    { state: searchRegex }
                ]
            };
        }
        // Check if it's a filter export
        else {
            // Status filter
            if (req.query.status) {
                query.status = req.query.status;
            }

            // Date range filter
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

            // State filter
            if (req.query.state) {
                query.state = req.query.state;
            }
        }

        // Fetch branch data with query
        const branchData = await Branch.find(query).sort({ createdAt: -1 }).lean();

        if (!branchData || branchData.length === 0) {
            return res.status(404).json({ message: 'No branch data found' });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Branches Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Branch Name', key: 'name', width: 25 },
            { header: 'Branch Short Code', key: 'branchShortCode', width: 18 },
            { header: 'State', key: 'state', width: 20 },
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
        branchData.forEach((branch, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                name: branch.name || '',
                branchShortCode: branch.branchShortCode || '',
                state: branch.state || '',
                status: branch.status || '',
                createdAt: branch.createdAt ? new Date(branch.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: branch.modifiedAt ? new Date(branch.modifiedAt).toLocaleDateString('en-IN') : ''
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
        let fileName = 'branches_data';
        if (req.query.search) {
            fileName = `branches_search_${req.query.search}`;
        } else if (req.query.status || req.query.startDate || req.query.endDate || req.query.state) {
            fileName = 'branches_filtered';
        }
        fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Branch Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting branch data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
