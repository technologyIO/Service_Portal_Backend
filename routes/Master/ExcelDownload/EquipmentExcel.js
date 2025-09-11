const express = require('express');
const ExcelJS = require('exceljs');
const Equipment = require('../../../Model/MasterSchema/EquipmentSchema');
const router = express.Router();

// Updated Equipment Excel export with filters and search support
router.get('/export-equipments', async (req, res) => {
    try {
        let query = {};

        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query = {
                $or: [
                    { name: searchRegex },
                    { materialdescription: searchRegex },
                    { serialnumber: searchRegex },
                    { materialcode: searchRegex },
                    { status: searchRegex },
                    { currentcustomer: searchRegex },
                    { dealer: searchRegex },
                    { palnumber: searchRegex },
                    { equipmentid: searchRegex },
                    { installationreportno: searchRegex }
                ]
            };
        }
        // Check if it's a filter export
        else if (Object.keys(req.query).some(key =>
            ['status', 'materialCode', 'dealer', 'currentCustomer', 'endCustomer', 'palNumber', 'startDate', 'endDate', 'custWarrantyStartDate', 'custWarrantyEndDate'].includes(key) && req.query[key]
        )) {
            // Status filter
            if (req.query.status) {
                query.status = req.query.status;
            }

            // Material code filter
            if (req.query.materialCode) {
                query.materialcode = req.query.materialCode;
            }

            // Dealer filter
            if (req.query.dealer) {
                query.dealer = req.query.dealer;
            }

            // Current customer filter
            if (req.query.currentCustomer) {
                query.currentcustomer = req.query.currentCustomer;
            }

            // End customer filter
            if (req.query.endCustomer) {
                query.endcustomer = req.query.endCustomer;
            }

            // PAL number filter
            if (req.query.palNumber) {
                query.palnumber = { $regex: req.query.palNumber, $options: 'i' };
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

            // Customer warranty date filters
            if (req.query.custWarrantyStartDate) {
                query.custWarrantystartdate = {
                    $gte: req.query.custWarrantyStartDate
                };
            }

            if (req.query.custWarrantyEndDate) {
                query.custWarrantyenddate = {
                    $lte: req.query.custWarrantyEndDate
                };
            }
        }

        console.log('Excel Export Query:', query);
        console.log('Request Query Params:', req.query);

        // Set response headers for file download
        let fileName = 'equipment_data';
        if (req.query.search) {
            fileName = `equipment_search_${req.query.search.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else if (Object.keys(req.query).some(key =>
            ['status', 'materialCode', 'dealer', 'currentCustomer', 'endCustomer'].includes(key) && req.query[key]
        )) {
            fileName = 'equipment_filtered';
        }
        fileName += `_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Create streaming workbook writer
        const workbookWriter = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res,
            useStyles: true,
            useSharedStrings: true
        });

        const worksheet = workbookWriter.addWorksheet('Equipment Data');

        // Define columns with optimized widths
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Equipment ID', key: 'equipmentid', width: 20 },
            { header: 'Material Description', key: 'materialdescription', width: 30 },
            { header: 'Serial Number', key: 'serialnumber', width: 20 },
            { header: 'Material Code', key: 'materialcode', width: 18 },
            { header: 'Current Customer', key: 'currentcustomer', width: 25 },
            { header: 'End Customer', key: 'endcustomer', width: 25 },
            { header: 'Dealer', key: 'dealer', width: 20 },
            { header: 'Customer Warranty Start Date', key: 'custWarrantystartdate', width: 25 },
            { header: 'Customer Warranty End Date', key: 'custWarrantyenddate', width: 25 },
            { header: 'Dealer Warranty Start Date', key: 'dealerwarrantystartdate', width: 25 },
            { header: 'Dealer Warranty End Date', key: 'dealerwarrantyenddate', width: 25 },
            { header: 'PAL Number', key: 'palnumber', width: 18 },
            { header: 'Installation Report No.', key: 'installationreportno', width: 25 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Created At', key: 'createdAt', width: 18 },
            { header: 'Modified At', key: 'modifiedAt', width: 18 }
        ];

        // Style only the header row (for performance)
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4472C4' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.commit();

        // Get MongoDB cursor for streaming with query
        const cursor = Equipment.find(query).lean().cursor();
        let rowIndex = 0;

        console.log('Starting cursor stream...');

        // Process data in chunks
        cursor.on('data', (equipment) => {
            rowIndex++;
            worksheet.addRow({
                sno: rowIndex,
                equipmentid: equipment.equipmentid || '',
                materialdescription: equipment.materialdescription || '',
                serialnumber: equipment.serialnumber || '',
                materialcode: equipment.materialcode || '',
                currentcustomer: equipment.currentcustomer || '',
                endcustomer: equipment.endcustomer || '',
                dealer: equipment.dealer || '',
                custWarrantystartdate: equipment.custWarrantystartdate || '',
                custWarrantyenddate: equipment.custWarrantyenddate || '',
                dealerwarrantystartdate: equipment.dealerwarrantystartdate || '',
                dealerwarrantyenddate: equipment.dealerwarrantyenddate || '',
                palnumber: equipment.palnumber || '',
                installationreportno: equipment.installationreportno || '',
                status: equipment.status || '',
                createdAt: equipment.createdAt ? new Date(equipment.createdAt).toLocaleDateString('en-IN') : '',
                modifiedAt: equipment.modifiedAt ? new Date(equipment.modifiedAt).toLocaleDateString('en-IN') : ''
            }).commit(); // Commit each row immediately
        });

        cursor.on('error', (error) => {
            console.error('Cursor error:', error);
            workbookWriter.rollback();
            if (!res.headersSent) {
                res.status(500).json({
                    message: 'Database stream error',
                    error: error.message,
                    query: query
                });
            }
        });

        cursor.on('end', async () => {
            try {
                console.log(`Processed ${rowIndex} records`);
                if (rowIndex === 0) {
                    // No data found, send error response
                    if (!res.headersSented) {
                        workbookWriter.rollback();
                        res.status(404).json({
                            message: 'No equipment data found',
                            query: query,
                            queryParams: req.query
                        });
                        return;
                    }
                }
                await worksheet.commit();
                await workbookWriter.commit();
                console.log('Excel export completed successfully');
            } catch (commitError) {
                console.error('Commit error:', commitError);
                if (!res.headersSent) {
                    res.status(500).json({
                        message: 'Excel generation failed',
                        error: commitError.message
                    });
                }
            }
        });

    } catch (setupError) {
        console.error('Setup error:', setupError);
        if (!res.headersSent) {
            res.status(500).json({
                message: 'Export initialization failed',
                error: setupError.message
            });
        }
    }
});

module.exports = router;
