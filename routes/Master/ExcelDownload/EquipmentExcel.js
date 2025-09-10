const express = require('express');
const ExcelJS = require('exceljs');
const Equipment = require('../../../Model/MasterSchema/EquipmentSchema');
const router = express.Router();

// Optimized Equipment Excel export API
router.get('/export-equipments', async (req, res) => {
    // Set response headers first
    const fileName = `equipment_data_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    try {
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
            { header: 'Created At', key: 'createdAt', width: 18 },
            { header: 'Modified At', key: 'modifiedAt', width: 18 },
            { header: 'Status', key: 'status', width: 15 }
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

        // Get MongoDB cursor for streaming
        const cursor = Equipment.find().lean().cursor();
        let rowIndex = 0;

        // Process data in chunks
        cursor.on('data', (equipment) => {
            rowIndex++;
            worksheet.addRow({
                sno: rowIndex,
                equipmentid: equipment.equipmentid || '',
                materialdescription: equipment.materialdescription || '',
                serialnumber: equipment.serialnumber || '',
                materialcode: equipment.materialcode || '',
                status: equipment.status || '',
                currentcustomer: equipment.currentcustomer || '',
                endcustomer: equipment.endcustomer || '',
                dealer: equipment.dealer || '',
                custWarrantystartdate: equipment.custWarrantystartdate || '',
                custWarrantyenddate: equipment.custWarrantyenddate || '',
                dealerwarrantystartdate: equipment.dealerwarrantystartdate || '',
                dealerwarrantyenddate: equipment.dealerwarrantyenddate || '',
                palnumber: equipment.palnumber || '',
                installationreportno: equipment.installationreportno || '',
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
                    error: error.message
                });
            }
        });

        cursor.on('end', async () => {
            try {
                await worksheet.commit();
                await workbookWriter.commit();
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