
const express = require('express');
const { parse, isValid } = require('date-fns');
const XLSX = require('xlsx');
const multer = require('multer');
const router = express.Router();
const PendingInstallation  = require('../../Model/UploadSchema/PendingInstallationSchema');
const upload = multer({ storage: multer.memoryStorage() });


router.post('/bulk-upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        // Read Excel with date handling
        const workbook = XLSX.read(req.file.buffer, { 
            type: "buffer", 
            cellDates: true,
            dateNF: 'dd"/"mm"/"yyyy;@'
        });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        const totalRecords = jsonData.length;
        let processed = 0;
        const insertionResults = [];
        const errors = [];

        // Universal date parser
        const parseUniversalDate = (dateInput) => {
            if (!dateInput) return null;
            
            if (dateInput instanceof Date && !isNaN(dateInput)) {
                return dateInput;
            }
            
            if (typeof dateInput === 'number') {
                const excelDate = XLSX.SSF.parse_date_code(dateInput);
                return new Date(excelDate.y, excelDate.m - 1, excelDate.d);
            }
            
            const formats = [
                'dd/MM/yyyy', 'dd-MM-yyyy', 'dd.MM.yyyy',
                'MM/dd/yyyy', 'MM-dd-yyyy', 'MM.dd.yyyy',
                'yyyy/MM/dd', 'yyyy-MM-dd', 'yyyy.MM.dd',
                'd/M/yyyy', 'd-M-yyyy', 'd.M.yyyy',
                'M/d/yyyy', 'M-d-yyyy', 'M.d.yyyy',
                'dd/MM/yy', 'dd-MM-yy', 'dd.MM.yy'
            ];
            
            for (const format of formats) {
                try {
                    const parsedDate = parse(dateInput.toString(), format, new Date());
                    if (isValid(parsedDate)) {
                        return parsedDate;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            throw new Error(`Unrecognized date format: ${dateInput}`);
        };

        // Process records in batches
        const batchSize = 100;
        for (let i = 0; i < jsonData.length; i += batchSize) {
            const batch = jsonData.slice(i, i + batchSize);
            const bulkOps = [];

            for (const record of batch) {
                try {
                    // Validate required fields
                    const requiredFields = [
                        'invoiceno', 'invoicedate', 'distchnl', 'customerid',
                        'material', 'description', 'serialnumber',
                        'salesdist', 'salesoff', 'currentcustomerid', 'mtl_grp4'
                    ];
                    
                    const missingFields = requiredFields.filter(field => !record[field]);
                    if (missingFields.length > 0) {
                        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
                    }

                    // Prepare document
                    const doc = {
                        invoiceno: record.invoiceno,
                        invoicedate: parseUniversalDate(record.invoicedate),
                        distchnl: record.distchnl,
                        customerid: record.customerid,
                        customername1: record.customername1 || '',
                        customername2: record.customername2 || '',
                        customercity: record.customercity || '',
                        customerpostalcode: record.customerpostalcode || '',
                        material: record.material,
                        description: record.description,
                        serialnumber: record.serialnumber,
                        salesdist: record.salesdist,
                        salesoff: record.salesoff,
                        customercountry: record.customercountry || '',
                        customerregion: record.customerregion || '',
                        currentcustomerid: record.currentcustomerid,
                        currentcustomername1: record.currentcustomername1 || '',
                        currentcustomername2: record.currentcustomername2 || '',
                        currentcustomercity: record.currentcustomercity || '',
                        currentcustomerregion: record.currentcustomerregion || '',
                        currentcustomerpostalcode: record.currentcustomerpostalcode || '',
                        currentcustomercountry: record.currentcustomercountry || '',
                        mtl_grp4: record.mtl_grp4,
                        key: record.key || '',
                        palnumber: record.palnumber || '',
                        status: ['Active', 'Deactive'].includes(record.status) ? record.status : 'Active'
                    };

                    bulkOps.push({
                        updateOne: {
                            filter: { serialnumber: doc.serialnumber },
                            update: { $set: doc },
                            upsert: true
                        }
                    });

                    insertionResults.push({
                        serialnumber: record.serialnumber,
                        status: "Processed"
                    });
                    processed++;
                } catch (error) {
                    errors.push({
                        record: record.invoiceno || 'Unknown',
                        serialnumber: record.serialnumber || 'Unknown',
                        error: error.message
                    });
                    insertionResults.push({
                        serialnumber: record.serialnumber || 'Unknown',
                        status: "Failed",
                        error: error.message
                    });
                }
            }

            // Execute bulk operation
            if (bulkOps.length > 0) {
                await PendingInstallation.bulkWrite(bulkOps).catch(err => {
                    console.error("Bulk write error:", err);
                    throw err;
                });
            }
        }

        return res.status(200).json({
            success: true,
            totalRecords,
            processed,
            failed: errors.length,
            insertionResults,
            errors
        });

    } catch (error) {
        console.error("Bulk upload error:", error);
        return res.status(500).json({ 
            success: false,
            error: "Server Error",
            message: error.message 
        });
    }
});
module.exports = router;