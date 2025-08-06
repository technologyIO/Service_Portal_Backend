const express = require('express');
const ExcelJS = require('exceljs');
const ReportedProblem = require('../../../Model/MasterSchema/ReportedProblemSchema'); 
const router = express.Router();

// ReportedProblem Excel export API
router.get('/export-reportedproblems', async (req, res) => {
    try {
        // Sabhi reported problem records fetch kariye
        const reportedProblemData = await ReportedProblem.find({}).lean();

        if (!reportedProblemData || reportedProblemData.length === 0) {
            return res.status(404).json({ message: 'No reported problem data found' });
        }

        // Nyi Excel workbook banayiye
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

        // Response headers set kariye
        const fileName = `reported_problems_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Excel file write kariye
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('ReportedProblem Excel export error:', error);
        res.status(500).json({
            message: 'Error exporting reported problem data to Excel',
            error: error.message
        });
    }
});

module.exports = router;
