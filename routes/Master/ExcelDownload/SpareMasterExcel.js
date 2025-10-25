const express = require('express');
const ExcelJS = require('exceljs');
const SpareMaster = require('../../../Model/MasterSchema/SpareMasterSchema');
const router = express.Router();

// Updated SpareMaster Excel export with filters and search support
router.get('/export-sparemaster', async (req, res) => {
    try {
        let query = {};
        
        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query = {
                $or: [
                    { Sub_grp: searchRegex },
                    { PartNumber: searchRegex },
                    { Description: searchRegex },
                    { Type: searchRegex },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$Rate" },
                                regex: req.query.search,
                                options: "i"
                            }
                        }
                    },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$DP" },
                                regex: req.query.search,
                                options: "i"
                            }
                        }
                    },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$Charges" },
                                regex: req.query.search,
                                options: "i"
                            }
                        }
                    }
                ]
            };
        }
        // Check if it's a filter export
        else if (Object.keys(req.query).some(key => 
            ['status', 'subGroup', 'type', 'rateMin', 'rateMax', 'dpMin', 'dpMax', 'chargesMin', 'chargesMax', 'createdStartDate', 'createdEndDate', 'modifiedStartDate', 'modifiedEndDate'].includes(key) && req.query[key]
        )) {
            // Status filter
            if (req.query.status) {
                query.status = req.query.status;
            }

            // Sub Group filter
            if (req.query.subGroup) {
                query.Sub_grp = req.query.subGroup;
            }

            // Type filter
            if (req.query.type) {
                query.Type = req.query.type;
            }

            // Rate range filter
            if (req.query.rateMin || req.query.rateMax) {
                query.Rate = {};
                if (req.query.rateMin) {
                    query.Rate.$gte = parseFloat(req.query.rateMin);
                }
                if (req.query.rateMax) {
                    query.Rate.$lte = parseFloat(req.query.rateMax);
                }
            }

            // DP range filter
            if (req.query.dpMin || req.query.dpMax) {
                query.DP = {};
                if (req.query.dpMin) {
                    query.DP.$gte = parseFloat(req.query.dpMin);
                }
                if (req.query.dpMax) {
                    query.DP.$lte = parseFloat(req.query.dpMax);
                }
            }

            // Charges range filter
            if (req.query.chargesMin || req.query.chargesMax) {
                query.Charges = {};
                if (req.query.chargesMin) {
                    query.Charges.$gte = parseFloat(req.query.chargesMin);
                }
                if (req.query.chargesMax) {
                    query.Charges.$lte = parseFloat(req.query.chargesMax);
                }
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

        // Fetch spare master data with query
        const spareMasterData = await SpareMaster.find(query).sort({ createdAt: -1 }).lean();

        console.log('Found records:', spareMasterData.length);

        if (!spareMasterData || spareMasterData.length === 0) {
            return res.status(404).json({ 
                message: 'No spare master data found',
                query: query,
                queryParams: req.query
            });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Spare Master Data');

        // Headers define kariye - Status field added
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Sub Group', key: 'Sub_grp', width: 20 },
            { header: 'Part Number', key: 'PartNumber', width: 20 },
            { header: 'Description', key: 'Description', width: 35 },
            { header: 'Type', key: 'Type', width: 15 },
            { header: 'Rate', key: 'Rate', width: 15 },
            { header: 'DP', key: 'DP', width: 18 },
            { header: 'Charges', key: 'Charges', width: 22 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Spare Image URL', key: 'spareiamegUrl', width: 30 },
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
        spareMasterData.forEach((spare, index) => {
            // Charges field ko safely handle kariye (Mixed type hai)
            const chargesValue = spare.Charges !== null && spare.Charges !== undefined
                ? (typeof spare.Charges === 'object' ? JSON.stringify(spare.Charges) : spare.Charges.toString())
                : '';

            const row = worksheet.addRow({
                sno: index + 1,
                Sub_grp: spare.Sub_grp || '',
                PartNumber: spare.PartNumber || '',
                Description: spare.Description || '',
                Type: spare.Type || '',
                Rate: spare.Rate || '',
                DP: spare.DP || '',
                Charges: chargesValue,
                status: spare.status || 'Active',
                spareiamegUrl: spare.spareiamegUrl || '',
                createdAt: spare.createdAt ? new Date(spare.createdAt).toLocaleDateString('en-IN') : '',
                updatedAt: spare.updatedAt ? new Date(spare.updatedAt).toLocaleDateString('en-IN') : ''
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
                } else if (colNumber === 4) { // Description column - wrap text
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if (colNumber === 9) { // Status column - center align
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
                } else if (colNumber === 10) { // Image URL column - wrap text
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if ([6, 7, 8].includes(colNumber)) { // Price columns - right align
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
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
        let fileName = 'spare_master_data';
        if (req.query.search) {
            fileName = `spare_master_search_${req.query.search.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else if (Object.keys(req.query).some(key => 
            ['status', 'subGroup', 'type', 'rateMin', 'rateMax'].includes(key) && req.query[key]
        )) {
            fileName = 'spare_master_filtered';
        }
        fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('SpareMaster Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting spare master data to Excel',
            error: error.message,
            query: req.query
        });
    }
});

module.exports = router;
