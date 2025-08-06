const express = require('express');
const ExcelJS = require('exceljs');
const PM = require('../../../Model/UploadSchema/PMSchema');
const router = express.Router();

// Ultra-light PM Excel export API
router.get('/export-pm', async (req, res) => {
    const fileName = `pm_data_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    try {
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res,
            useStyles: false,  // Disable styles for maximum performance
            useSharedStrings: true
        });
        
        const worksheet = workbook.addWorksheet('PM Data');

        // Minimal column definitions (no styling)
        worksheet.columns = [
            { header: 'S.No', key: 'sno' },
            { header: 'PM Type', key: 'pmType' },
            { header: 'PM Number', key: 'pmNumber' },
            { header: 'Material Description', key: 'materialDescription' },
            { header: 'Document Number', key: 'documentnumber' },
            { header: 'Serial Number', key: 'serialNumber' },
            { header: 'Customer Code', key: 'customerCode' },
            { header: 'Region', key: 'region' },
            { header: 'City', key: 'city' },
            { header: 'PM Due Month', key: 'pmDueMonth' },
            { header: 'PM Done Date', key: 'pmDoneDate' },
            { header: 'PM Vendor Code', key: 'pmVendorCode' },
            { header: 'PM Engineer Code', key: 'pmEngineerCode' },
            { header: 'PM Status', key: 'pmStatus' },
            { header: 'Part Number', key: 'partNumber' },
            { header: 'Created At', key: 'createdAt' },
            { header: 'Updated At', key: 'updatedAt' }
        ];

        // Get cursor without loading all data
        const cursor = PM.find().lean().cursor();
        let rowCount = 0;

        cursor.on('data', (pm) => {
            rowCount++;
            worksheet.addRow({
                sno: rowCount,
                pmType: pm.pmType || '',
                pmNumber: pm.pmNumber || '',
                materialDescription: pm.materialDescription || '',
                documentnumber: pm.documentnumber || '',
                serialNumber: pm.serialNumber || '',
                customerCode: pm.customerCode || '',
                region: pm.region || '',
                city: pm.city || '',
                pmDueMonth: pm.pmDueMonth || '',
                pmDoneDate: pm.pmDoneDate || '',
                pmVendorCode: pm.pmVendorCode || '',
                pmEngineerCode: pm.pmEngineerCode || '',
                pmStatus: pm.pmStatus || '',
                partNumber: pm.partNumber || '',
                createdAt: pm.createdAt ? new Date(pm.createdAt).toLocaleDateString('en-IN') : '',
                updatedAt: pm.updatedAt ? new Date(pm.updatedAt).toLocaleDateString('en-IN') : ''
            }).commit(); // Commit immediately
        });

        cursor.on('error', (err) => {
            console.error('Error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            }
            workbook.rollback();
        });

        cursor.on('end', async () => {
            try {
                await workbook.commit();
            } catch (err) {
                if (!res.headersSent) {
                    res.status(500).json({ error: err.message });
                }
            }
        });

    } catch (error) {
        console.error('Export failed:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

module.exports = router;