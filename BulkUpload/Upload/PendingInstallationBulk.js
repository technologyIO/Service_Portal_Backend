const express = require('express');
const { parse, isValid } = require('date-fns');
const XLSX = require('xlsx');
const multer = require('multer');
const router = express.Router();
const PendingInstallation = require('../../Model/UploadSchema/PendingInstallationSchema');
const Customer = require('../../Model/UploadSchema/CustomerSchema');
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

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
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

        // Process records one by one
        for (const [index, record] of jsonData.entries()) {
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

                // Lookup customer data
                let customerData = {};
                try {
                    const customer = await Customer.findOne({
                        $or: [
                            { customercodeid: record.customerid },
                            { email: record.customerid }
                        ]
                    });

                    if (customer) {
                        customerData = {
                            customername1: customer.customername || '',
                            customername2: customer.hospitalname || '',
                            customercity: customer.city || '',
                            customerpostalcode: customer.postalcode || '',
                            customercountry: customer.country || '',
                            customerregion: customer.region || ''
                        };
                    }
                } catch (err) {
                    console.error(`Error fetching customer data for ${record.customerid}:`, err);
                }

                // Lookup current customer data
                let currentCustomerData = {};
                try {
                    const currentCustomer = await Customer.findOne({
                        $or: [
                            { customercodeid: record.currentcustomerid },
                            { email: record.currentcustomerid }
                        ]
                    });

                    if (currentCustomer) {
                        currentCustomerData = {
                            currentcustomername1: currentCustomer.customername || '',
                            currentcustomername2: currentCustomer.hospitalname || '',
                            currentcustomercity: currentCustomer.city || '',
                            currentcustomerpostalcode: currentCustomer.postalcode || '',
                            currentcustomercountry: currentCustomer.country || '',
                            currentcustomerregion: currentCustomer.region || ''
                        };
                    }
                } catch (err) {
                    console.error(`Error fetching current customer data for ${record.currentcustomerid}:`, err);
                }

                // Prepare document with customer data
                const doc = {
                    invoiceno: record.invoiceno,
                    invoicedate: parseUniversalDate(record.invoicedate),
                    distchnl: record.distchnl,
                    customerid: record.customerid,
                    material: record.material,
                    description: record.description,
                    serialnumber: record.serialnumber,
                    salesdist: record.salesdist,
                    salesoff: record.salesoff,
                    currentcustomerid: record.currentcustomerid,
                    mtl_grp4: record.mtl_grp4,
                    key: record.key || '',
                    palnumber: record.palnumber || '',
                    status: ['Active', 'Deactive'].includes(record.status) ? record.status : 'Active',
                    ...customerData,
                    ...currentCustomerData
                };

                // Update or create the record
                await PendingInstallation.findOneAndUpdate(
                    { serialnumber: doc.serialnumber },
                    { $set: doc },
                    { upsert: true }
                );

                insertionResults.push({
                    serialnumber: record.serialnumber,
                    status: "Processed"
                });
                processed++;

                // Send progress update for every 10 records or last record
                if ((index + 1) % 10 === 0 || index === jsonData.length - 1) {
                    // Flush headers if not already sent
                    if (!res.headersSent) {
                        res.writeHead(200, {
                            'Content-Type': 'application/json',
                            'Transfer-Encoding': 'chunked'
                        });
                    }

                    res.write(JSON.stringify({
                        status: 'processing',
                        current: index + 1,
                        total: totalRecords,
                        percentage: Math.round(((index + 1) / totalRecords) * 100),
                        processed: processed,
                        failed: errors.length,
                        currentRecord: {
                            serialnumber: record.serialnumber,
                            invoiceno: record.invoiceno
                        },
                        message: `Processing record ${index + 1} of ${totalRecords}`
                    }) + '\n');

                }

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

                // Send error update
                if (!res.headersSent) {
                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Transfer-Encoding': 'chunked'
                    });
                }

                res.write(JSON.stringify({
                    status: 'error',
                    current: index + 1,
                    total: totalRecords,
                    errorRecord: {
                        serialnumber: record.serialnumber || 'Unknown',
                        invoiceno: record.invoiceno || 'Unknown',
                        error: error.message
                    },
                    message: `Error processing record ${index + 1}`
                }) + '\n');
            }
        }

        // Final response
        if (!res.headersSent) {
            return res.status(200).json({
                status: 'completed',
                success: true,
                totalRecords: totalRecords,
                processed: processed,
                failed: errors.length,
                insertionResults: insertionResults,
                errors: errors
            });
        } else {
            // If we've been streaming, send the final message
            res.write(JSON.stringify({
                status: 'completed',
                success: true,
                totalRecords: totalRecords,
                processed: processed,
                failed: errors.length,
                insertionResults: insertionResults,
                errors: errors
            }) + '\n');
            res.end();
        }

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