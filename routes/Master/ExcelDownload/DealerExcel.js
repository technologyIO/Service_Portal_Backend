const express = require('express');
const ExcelJS = require('exceljs');
const Dealer = require('../../../Model/MasterSchema/DealerSchema');
const router = express.Router();
router.get('/filter-options', async (req, res) => {
    try {
        const dealers = await Dealer.find({}, {
            state: 1,
            city: 1,
            personresponsible: 1
        });

        const states = [...new Set(dealers.flatMap(d => d.state || []))];
        const cities = [...new Set(dealers.flatMap(d => d.city || []))];
        const persons = [...new Set(dealers.flatMap(d =>
            (d.personresponsible || []).map(p => p.name)
        ))];

        res.json({
            states: states.sort(),
            cities: cities.sort(),
            persons: persons.sort()
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/filter', async (req, res) => {
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
                endDate.setHours(23, 59, 59, 999);
                filters.createdAt.$lte = endDate;
            }
        }

        // State filter (array contains)
        if (req.query.state) {
            filters.state = { $in: [req.query.state] };
        }

        // City filter (array contains)
        if (req.query.city) {
            filters.city = { $in: [req.query.city] };
        }

        // Person responsible filter
        if (req.query.personResponsible) {
            filters['personresponsible.name'] = {
                $regex: new RegExp(req.query.personResponsible, 'i')
            };
        }

        const dealers = await Dealer.find(filters)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const totalDealers = await Dealer.countDocuments(filters);
        const totalPages = Math.ceil(totalDealers / limit);

        res.json({
            dealers,
            totalPages,
            totalDealers,
            currentPage: page,
            filters: req.query
        });
    } catch (err) {
        console.error('Filter error:', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/searchdealer', async (req, res) => {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        if (!q || typeof q !== 'string') {
            return res.status(400).json({ message: 'Query parameter is required and must be a string' });
        }

        const query = {
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { 'personresponsible.name': { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { dealercode: { $regex: q, $options: 'i' } },
                { city: { $regex: q, $options: 'i' } },
                { state: { $regex: q, $options: 'i' } },
                { pincode: { $regex: q, $options: 'i' } },
                { address: { $regex: q, $options: 'i' } }
            ]
        };

        const dealers = await Dealer.find(query).skip(skip).limit(limit).sort({ createdAt: -1 });
        const totalDealers = await Dealer.countDocuments(query);
        const totalPages = Math.ceil(totalDealers / limit);

        res.json({
            dealers,
            totalPages,
            totalDealers,
            currentPage: page,
            isSearch: true
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// Updated Dealer Excel export with filters and search support
router.get('/export-dealers', async (req, res) => {
    try {
        let query = {};

        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query = {
                $or: [
                    { name: searchRegex },
                    { 'personresponsible.name': searchRegex },
                    { email: searchRegex },
                    { dealercode: searchRegex },
                    { city: searchRegex },
                    { state: searchRegex },
                    { pincode: searchRegex },
                    { address: searchRegex }
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
                query.state = { $in: [req.query.state] };
            }

            // City filter
            if (req.query.city) {
                query.city = { $in: [req.query.city] };
            }

            // Person responsible filter
            if (req.query.personResponsible) {
                query['personresponsible.name'] = {
                    $regex: new RegExp(req.query.personResponsible, 'i')
                };
            }
        }

        // Fetch dealer data with query
        const dealerData = await Dealer.find(query).sort({ createdAt: -1 }).lean();

        if (!dealerData || dealerData.length === 0) {
            return res.status(404).json({ message: 'No dealer data found' });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Dealers Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Dealer Name', key: 'name', width: 25 },
            { header: 'Dealer Code', key: 'dealercode', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Person Responsible', key: 'personresponsible', width: 40 },
            { header: 'States', key: 'state', width: 30 },
            { header: 'Cities', key: 'city', width: 30 },
            { header: 'Address', key: 'address', width: 40 },
            { header: 'Pincode', key: 'pincode', width: 12 },
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
        dealerData.forEach((dealer, index) => {
            // Person Responsible format kariye with safety check
            const personResponsibleText = dealer.personresponsible && Array.isArray(dealer.personresponsible) && dealer.personresponsible.length > 0
                ? dealer.personresponsible.map(person =>
                    `Name: ${person?.name || 'N/A'}, Employee ID: ${person?.employeeid || 'N/A'}`
                ).join(' | ')
                : 'No person assigned';

            // States format kariye with safety check
            const statesText = dealer.state && Array.isArray(dealer.state) && dealer.state.length > 0
                ? dealer.state.join(', ')
                : dealer.state
                    ? (typeof dealer.state === 'string' ? dealer.state : 'N/A')
                    : 'No states';

            // Cities format kariye with safety check
            const citiesText = dealer.city && Array.isArray(dealer.city) && dealer.city.length > 0
                ? dealer.city.join(', ')
                : dealer.city
                    ? (typeof dealer.city === 'string' ? dealer.city : 'N/A')
                    : 'No cities';

            const row = worksheet.addRow({
                sno: index + 1,
                name: dealer.name || '',
                dealercode: dealer.dealercode || '',
                email: dealer.email || '',
                status: dealer.status || '',
                personresponsible: personResponsibleText,
                state: statesText,
                city: citiesText,
                address: dealer.address || '',
                pincode: dealer.pincode || '',
                createdAt: dealer.createdAt ? new Date(dealer.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: dealer.modifiedAt ? new Date(dealer.modifiedAt).toLocaleDateString('en-IN') : ''
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
                } else if (colNumber === 6) { // Person Responsible column
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                } else if (colNumber === 9) { // Address column
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
        let fileName = 'dealers_data';
        if (req.query.search) {
            fileName = `dealers_search_${req.query.search}`;
        } else if (req.query.status || req.query.startDate || req.query.endDate || req.query.state || req.query.city || req.query.personResponsible) {
            fileName = 'dealers_filtered';
        }
        fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Dealer Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting dealer data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
