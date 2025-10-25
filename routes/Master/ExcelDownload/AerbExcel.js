const express = require('express');
const ExcelJS = require('exceljs');
const Aerb = require('../../../Model/MasterSchema/AerbSchema');
const router = express.Router();
router.get('/aerb/filter', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filters = {};

        // Status filter
        if (req.query.status) {
            filters.status = req.query.status;
        }

        // Date range filter
        if (req.query.startDate || req.query.endDate) {
            filters.createdAt = {};
            if (req.query.startDate) {
                filters.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                const endDate = new Date(req.query.endDate);
                endDate.setHours(23, 59, 59, 999); // End of day
                filters.createdAt.$lte = endDate;
            }
        }

        const aerbEntries = await Aerb.find(filters)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const totalAerb = await Aerb.countDocuments(filters);
        const totalPages = Math.ceil(totalAerb / limit);

        res.json({
            aerbEntries,
            totalPages,
            totalAerb,
            currentPage: page,
            filters: req.query
        });
    } catch (err) {
        console.error('Filter error:', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/searchaerb', async (req, res) => {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        if (!q) {
            return res.status(400).json({ message: 'Query parameter "q" is required' });
        }

        const query = {
            $or: [
                { materialcode: { $regex: q, $options: 'i' } },
                { materialdescription: { $regex: q, $options: 'i' } }
            ]
        };

        const aerb = await Aerb.find(query).skip(skip).limit(limit).sort({ createdAt: -1 });
        const totalAerb = await Aerb.countDocuments(query);
        const totalPages = Math.ceil(totalAerb / limit);

        res.json({
            aerbEntries: aerb,
            totalPages,
            totalAerb,
            currentPage: page,
            isSearch: true
        });

    } catch (err) {
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// Updated AERB Excel export with filters and search support
router.get('/export-aerb', async (req, res) => {
    try {
        let query = {};

        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query = {
                $or: [
                    { materialcode: searchRegex },
                    { materialdescription: searchRegex }
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
        }

        // Fetch AERB data with query
        const aerbData = await Aerb.find(query).sort({ createdAt: -1 }).lean();

        if (!aerbData || aerbData.length === 0) {
            return res.status(404).json({ message: 'No AERB data found' });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('AERB Data');

        // Define columns
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Material Code', key: 'materialcode', width: 20 },
            { header: 'Material Description', key: 'materialdescription', width: 40 },
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

        // Add data rows
        aerbData.forEach((aerb, index) => {
            const row = worksheet.addRow({
                sno: index + 1,
                materialcode: aerb.materialcode || '',
                materialdescription: aerb.materialdescription || '',
                status: aerb.status || '',
                createdAt: aerb.createdAt ? new Date(aerb.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: aerb.modifiedAt ? new Date(aerb.modifiedAt).toLocaleDateString('en-IN') : ''
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
            column.width = maxLength < 10 ? 10 : maxLength + 2;
        });

        // Set response headers for file download
        let fileName = 'aerb_data';
        if (req.query.search) {
            fileName = `aerb_search_${req.query.search}`;
        } else if (req.query.status || req.query.startDate || req.query.endDate) {
            fileName = 'aerb_filtered';
        }
        fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('AERB Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting AERB data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
