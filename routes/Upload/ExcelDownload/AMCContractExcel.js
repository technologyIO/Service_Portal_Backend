const express = require('express');
const ExcelJS = require('exceljs');
const moment = require('moment');
const AMCContract = require('../../../Model/UploadSchema/AMCContractSchema');
const router = express.Router();

// Updated AMCContract Excel export with filters and search support
router.get('/export-amccontracts', async (req, res) => {
    try {
        let query = {};
        
        // Check if it's a search export
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            
            query = {
                $or: [
                    { salesdoc: searchRegex },
                    { satypeZDRC_ZDRN: searchRegex },
                    { serialnumber: searchRegex },
                    { materialcode: searchRegex },
                    { status: searchRegex }
                ]
            };
        }
        // Check if it's a filter export
        else if (Object.keys(req.query).some(key => 
            ['salesdoc', 'satypeZDRC_ZDRN', 'serialnumber', 'materialcode', 'status', 'startDateFrom', 'startDateTo', 'endDateFrom', 'endDateTo', 'createdStartDate', 'createdEndDate', 'modifiedStartDate', 'modifiedEndDate'].includes(key) && req.query[key]
        )) {
            if (req.query.salesdoc) {
                query.salesdoc = req.query.salesdoc;
            }
            if (req.query.satypeZDRC_ZDRN) {
                query.satypeZDRC_ZDRN = req.query.satypeZDRC_ZDRN;
            }
            if (req.query.serialnumber) {
                query.serialnumber = req.query.serialnumber;
            }
            if (req.query.materialcode) {
                query.materialcode = req.query.materialcode;
            }
            // ✅ FIXED: Status filter in Excel export
            if (req.query.status) {
                query.status = new RegExp(`^${req.query.status}$`, 'i');
            }
            if (req.query.startDateFrom || req.query.startDateTo) {
                query.startdate = {};
                if (req.query.startDateFrom) {
                    query.startdate.$gte = new Date(req.query.startDateFrom);
                }
                if (req.query.startDateTo) {
                    const endDate = new Date(req.query.startDateTo);
                    endDate.setHours(23, 59, 59, 999);
                    query.startdate.$lte = endDate;
                }
            }
            if (req.query.endDateFrom || req.query.endDateTo) {
                query.enddate = {};
                if (req.query.endDateFrom) {
                    query.enddate.$gte = new Date(req.query.endDateFrom);
                }
                if (req.query.endDateTo) {
                    const endDate = new Date(req.query.endDateTo);
                    endDate.setHours(23, 59, 59, 999);
                    query.enddate.$lte = endDate;
                }
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

        // Fetch AMC contract data with query
        const amcContractData = await AMCContract.find(query).sort({ startdate: -1 }).lean();

        console.log('Found records:', amcContractData.length);

        if (!amcContractData || amcContractData.length === 0) {
            return res.status(404).json({ 
                message: 'No AMC contract data found',
                query: query,
                queryParams: req.query
            });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('AMC Contracts Data');

        // Headers define kariye
        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Sales Doc', key: 'salesdoc', width: 18 },
            { header: 'Start Date', key: 'startdate', width: 15 },
            { header: 'End Date', key: 'enddate', width: 15 },
            { header: 'SA Type (ZDRC/ZDRN)', key: 'satypeZDRC_ZDRN', width: 20 },
            { header: 'Serial Number', key: 'serialnumber', width: 20 },
            { header: 'Material Code', key: 'materialcode', width: 18 },
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
        amcContractData.forEach((contract, index) => {
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
                salesdoc: contract.salesdoc || '',
                startdate: formatDateForExcel(contract.startdate),
                enddate: formatDateForExcel(contract.enddate),
                satypeZDRC_ZDRN: contract.satypeZDRC_ZDRN || '',
                serialnumber: contract.serialnumber || '',
                materialcode: contract.materialcode || '',
                status: getStatus(contract.status),
                createdAt: formatDateForExcel(contract.createdAt),
                modifiedAt: formatDateForExcel(contract.modifiedAt)
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
                if (colNumber === 1) { // S.No
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (colNumber === 3 || colNumber === 4) { // Date columns
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (cell.value && cell.value.trim() !== '') {
                        cell.font = { color: { argb: '0066CC' } };
                    }
                } else if (colNumber === 8) { // Status column
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
                } else if (colNumber === 9 || colNumber === 10) { // Created/Modified Date columns
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (cell.value && cell.value.trim() !== '') {
                        cell.font = { color: { argb: '0066CC' } };
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
        let fileName = 'amc_contracts_data';
        if (req.query.search) {
            fileName = `amc_contracts_search_${req.query.search.replace(/[^a-zA-Z0-9]/g, '_')}`;
        } else if (Object.keys(req.query).some(key => 
            ['salesdoc', 'satypeZDRC_ZDRN', 'serialnumber', 'materialcode', 'status'].includes(key) && req.query[key]
        )) {
            fileName = 'amc_contracts_filtered';
        }
        fileName += `_${moment().format('DD-MM-YYYY')}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('AMCContract Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting AMC contract data to Excel',
            error: error.message,
            query: req.query
        });
    }
});

module.exports = router;
