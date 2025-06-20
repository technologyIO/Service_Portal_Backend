const express = require('express');
const router = express.Router();
const Equipment = require('../../Model/MasterSchema/EquipmentSchema');
const PendingInstallation = require('../../Model/UploadSchema/PendingInstallationSchema'); // Adjust the path based on your folder structure
const nodemailer = require('nodemailer');
const pdf = require('html-pdf');
const FormatMaster = require("../../Model/MasterSchema/FormatMasterSchema");
const { getChecklistHTML } = require("./getChecklistHTML"); // the new function above
const EquipmentChecklist = require('../../Model/CollectionSchema/EquipmentChecklistSchema');
const User = require('../../Model/MasterSchema/UserSchema');
const InstallationReportCounter = require('../../Model/MasterSchema/InstallationReportCounterSchema');

const getCertificateHTML = require('./certificateTemplate'); // Our HTML template function
const AMCContract = require('../../Model/UploadSchema/AMCContractSchema');
const Customer = require('../../Model/UploadSchema/CustomerSchema'); // Adjust the path as necessary

// In-memory OTP store (for demonstration; consider a persistent store in production)
const otpStore = {};
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'webadmin@skanray-access.com',
        pass: 'rdzegwmzirvbjcpm'
    }
});
// router.post('/send-otp', async (req, res) => {
//     const { email } = req.body;

//     if (!email) {
//         return res.status(400).json({ message: 'Email is required' });
//     }

//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     otpStore[email] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };

//     const subject = 'Your OTP for Equipment Installation';
//     const body = `Your OTP is: ${otp}. It is valid for 5 minutes.`;

//     try {
//         await sendMail(email, subject, body);
//         res.status(200).json({ message: 'OTP sent successfully' });
//     } catch (error) {
//         res.status(500).json({ message: 'Failed to send OTP', error: error.message });
//     }
// });

function createPdfBuffer(htmlContent, options = {}) {
    return new Promise((resolve, reject) => {
        pdf.create(htmlContent, options).toBuffer((err, buffer) => {
            if (err) return reject(err);
            resolve(buffer);
        });
    });
}
// Middleware to get equipment by ID
async function getEquipmentById(req, res, next) {
    let equipment;
    try {
        equipment = await Equipment.findById(req.params.id);
        if (!equipment) {
            return res.status(404).json({ message: 'Equipment not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.equipment = equipment;
    next();
}

// Middleware to check for duplicate serial number
async function checkDuplicateSerialNumber(req, res, next) {
    let equipment;
    try {
        equipment = await Equipment.findOne({ serialnumber: req.body.serialnumber });
        if (equipment && equipment._id != req.params.id) {
            return res.status(400).json({ message: 'Serial number already exists' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}
// GET all serial numbers
router.get('/allequipment/serialnumbers', async (req, res) => {
    try {
        // Fetch all equipment entries
        const equipment = await Equipment.find({}, 'serialnumber'); // Select only the serialnumber field

        // Extract serial numbers into an array
        const serialNumbers = equipment.map(item => item.serialnumber);

        // Return the array of serial numbers
        res.json(serialNumbers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/equipment', async (req, res) => {
    const {
        materialdescription,
        serialnumber,
        materialcode,
        status,
        currentcustomer,
        endcustomer,
        equipmentid,
        custWarrantystartdate,
        custWarrantyenddate,
        dealerwarrantystartdate,
        dealerwarrantyenddate,
        dealer,
        palnumber,
        installationreportno
    } = req.body;

    const equipment = new Equipment({
        materialdescription,
        serialnumber,
        materialcode,
        status,
        currentcustomer,
        endcustomer,
        equipmentid,
        custWarrantystartdate,
        custWarrantyenddate,
        dealerwarrantystartdate,
        dealerwarrantyenddate,
        dealer,
        palnumber,
        installationreportno,
        createdAt: new Date(),
        modifiedAt: new Date()
    });

    try {
        const savedEquipment = await equipment.save();
        res.status(201).json(savedEquipment);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.get('/equipment-details/:serialnumber', async (req, res) => {
    try {
        const { serialnumber } = req.params;

        // 1. Retrieve equipment data using the serial number
        const equipmentData = await Equipment.findOne({ serialnumber });
        if (!equipmentData) {
            return res.status(404).json({ message: 'No equipment data found for the provided serial number' });
        }

        // 2. Using the material code from the equipment, find AMC contract data (only startdate and enddate)
        const materialCode = equipmentData.materialcode;
        const amcContract = await AMCContract.findOne({ materialcode: materialCode });
        const amcContractDates = amcContract
            ? { startdate: amcContract.startdate, enddate: amcContract.enddate }
            : {};

        // 3. Using the current customer code from the equipment, find customer details
        const customerCode = equipmentData.currentcustomer;
        const customerData = await Customer.findOne({ customercodeid: customerCode });
        const customerDetails = customerData
            ? {
                hospitalname: customerData.hospitalname,
                city: customerData.city,
                pincode: customerData.postalcode, // Assuming postalcode is used as pincode
                telephone: customerData.telephone,
                email: customerData.email,
                street: customerData.street,
            }
            : {};

        // 4. Find all equipments that have used this same customer code
        const customerEquipments = await Equipment.find(
            { currentcustomer: customerCode },
            'serialnumber materialcode name materialdescription'
        );

        // 5. Combine the data and return it
        const combinedData = {
            equipment: equipmentData,
            amcContract: amcContractDates,
            customer: customerDetails,
            customerEquipments // Array of equipments with serial number, material code, and name
        };

        res.json(combinedData);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/checkequipments/:customerCode', async (req, res) => {
    try {
        const { customerCode } = req.params;

        // 1. Find all equipments that belong to the provided customer code
        const equipments = await Equipment.find({ currentcustomer: customerCode });

        if (equipments.length === 0) {
            return res.status(404).json({ message: 'No equipment found for the provided customer code' });
        }

        // 2. Return full equipment details
        res.json({ equipments });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});




router.get('/getbyserialno/:serialnumber', async (req, res) => {
    try {
        const serialnumber = req.params.serialnumber;

        // Search for matching serial number in both collections
        const equipmentData = await Equipment.findOne({ serialnumber: serialnumber });
        // console.log("Serial number being queried:", serialnumber);

        const pendingInstallationData = await PendingInstallation.findOne({ serialnumber: new RegExp(`^${serialnumber}$`, 'i') });

        // console.log("Pending Installation Data:", pendingInstallationData);


        // Combine data from both collections if found
        const result = {
            equipmentData: equipmentData || null,
            pendingInstallationData: pendingInstallationData || null
        };

        // Check if at least one record is found
        if (!equipmentData && !pendingInstallationData) {
            return res.status(404).json({ message: 'No data found for the provided serial number' });
        }

        // Return the combined data
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// GET all equipment
router.get('/equipment', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const equipment = await Equipment.find().skip(skip).limit(limit);
        const totalEquipment = await Equipment.countDocuments();
        const totalPages = Math.ceil(totalEquipment / limit);

        res.json({
            equipment,
            totalPages,
            totalEquipment
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/allequipment', async (req, res) => {
    try {
        const equipment = await Equipment.find(); // Fetch all equipment without pagination

        res.json({
            equipment,
            totalEquipment: equipment.length, // Return the total number of equipment items
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// GET equipment by ID
router.get('/equipment/:id', getEquipmentById, (req, res) => {
    res.json(res.equipment);
});

router.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Store OTP with a 5-minute expiry
    otpStore[email] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };

    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Your OTP for Equipment Installation',
        text: `Your OTP is: ${otp}. It is valid for 5 minutes.`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to send OTP', error: error.message });
    }
});

// Endpoint to verify OTP
router.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }
    const record = otpStore[email];
    if (!record) {
        return res.status(400).json({ message: 'No OTP found for this email' });
    }
    if (Date.now() > record.expiresAt) {
        delete otpStore[email];
        return res.status(400).json({ message: 'OTP has expired' });
    }
    if (record.otp !== otp) {
        return res.status(400).json({ message: 'Invalid OTP' });
    }
    // If verified, remove OTP from store and return success
    delete otpStore[email];
    res.status(200).json({ message: 'OTP verified successfully' });
});


// Updated bulk endpoint
router.post("/equipment/bulk", async (req, res) => {
    // Set headers for SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Helper function to send progress updates
    const sendProgress = (data) => {
        try {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (err) {
            console.error('Failed to send progress update:', err);
        }
    };

    // Helper function to process equipment with retries
    const processEquipmentWithRetry = async (equipment, index, total, installationBuffer, newInstallationReportNo, pdfData) => {
        const MAX_RETRIES = 2;
        let retryCount = 0;
        let lastError = null;

        const serialNumber = equipment.serialnumber;

        while (retryCount <= MAX_RETRIES) {
            try {
                sendProgress({
                    type: 'equipment-start',
                    serialNumber,
                    index,
                    total,
                    message: `Processing equipment ${index + 1}/${total} (${serialNumber})${retryCount > 0 ? ` (retry ${retryCount})` : ''}`
                });

                // Find matching checklist
                const checklist = (req.body.checklistPayloads || []).find(cp =>
                    cp.serialNumber === serialNumber
                );

                // Generate checklist PDF if exists
                let checklistBuffer = null;
                if (checklist && checklist.checklistResults && checklist.checklistResults.length > 0) {
                    sendProgress({
                        type: 'status',
                        serialNumber,
                        message: 'Generating checklist PDF...'
                    });

                    // Fetch FormatMaster details with timeout
                    let formatDetails = { chlNo: "", revNo: "" };
                    try {
                        if (checklist.prodGroup) {
                            const formatDoc = await FormatMaster.findOne({ productGroup: checklist.prodGroup }).maxTimeMS(5000);
                            if (formatDoc) {
                                formatDetails.chlNo = formatDoc.chlNo;
                                formatDetails.revNo = formatDoc.revNo;
                            }
                        }
                    } catch (err) {
                        console.warn(`Failed to fetch format details for ${serialNumber}:`, err.message);
                    }

                    // Build checklist data
                    const checklistHtmlData = {
                        reportNo: newInstallationReportNo,
                        date: pdfData.dateOfInstallation || new Date().toLocaleDateString("en-GB"),
                        customer: {
                            hospitalname: pdfData.customerName || "",
                            customercodeid: pdfData.customerId || "",
                            street: pdfData.street || "",
                            city: pdfData.city || "",
                            telephone: pdfData.phoneNumber || "",
                            email: pdfData.email || "",
                        },
                        machine: {
                            partNumber: equipment.materialcode,
                            modelDescription: equipment.materialdescription,
                            serialNumber: serialNumber,
                            machineId: "",
                        },
                        remarkglobal: checklist.globalRemark || "",
                        checklistItems: checklist.checklistResults,
                        serviceEngineer: `${pdfData.userInfo?.firstName || ""} ${pdfData.userInfo?.lastName || ""}`,
                        formatChlNo: formatDetails.chlNo,
                        formatRevNo: formatDetails.revNo,
                    };

                    // Generate PDF with simplified options
                    try {
                        const checklistHtml = getChecklistHTML(checklistHtmlData);
                        checklistBuffer = await createPdfBuffer(checklistHtml, {
                            format: "A4",
                            orientation: "portrait",
                            border: "5mm",
                            timeout: 30000 // 30 seconds timeout
                        });
                    } catch (pdfErr) {
                        console.error(`PDF generation failed for ${serialNumber}:`, pdfErr);
                        // Fallback - continue without checklist PDF
                        checklistBuffer = null;
                        sendProgress({
                            type: 'warning',
                            serialNumber,
                            message: 'Checklist PDF generation failed, continuing without it'
                        });
                    }
                }

                // Send email to CIC
                sendProgress({
                    type: 'status',
                    serialNumber,
                    message: 'Preparing CIC email...'
                });

                const cicAttachments = [{
                    filename: "InstallationReport.pdf",
                    content: installationBuffer
                }];

                if (checklistBuffer) {
                    cicAttachments.push({
                        filename: `Checklist_${serialNumber}.pdf`,
                        content: checklistBuffer
                    });
                }

                const cicUser = await User.findOne({
                    'role.roleName': 'CIC',
                    'role.roleId': 'C1'
                }).maxTimeMS(5000);

                if (cicUser) {
                    const cicMailOptions = {
                        from: process.env.EMAIL_FROM || "webadmin@skanray-access.com",
                        to: cicUser.email,
                        subject: `Installation Report - ${serialNumber}`,
                        text: `Equipment processed: ${serialNumber}`,
                        attachments: cicAttachments,
                        // Important for large attachments
                        disableFileAccess: true,
                        disableUrlAccess: true
                    };

                    await transporter.sendMail(cicMailOptions);
                    sendProgress({
                        type: 'status',
                        serialNumber,
                        message: 'CIC email sent successfully'
                    });

                    // Send equipment data separately
                    const dataMailOptions = {
                        from: process.env.EMAIL_FROM || "webadmin@skanray-access.com",
                        to: cicUser.email,
                        subject: `Equipment Data - ${serialNumber}`,
                        text: JSON.stringify(equipment, null, 2)
                    };

                    await transporter.sendMail(dataMailOptions);
                } else {
                    sendProgress({
                        type: 'warning',
                        serialNumber,
                        message: 'CIC user not found - skipping email'
                    });
                }

                // If we got here, processing was successful
                return {
                    serialNumber,
                    status: "success",
                    message: "Processed successfully",
                    completed: index + 1,
                    total
                };

            } catch (error) {
                lastError = error;
                retryCount++;
                console.error(`Attempt ${retryCount} failed for ${serialNumber}:`, error.message);

                if (retryCount <= MAX_RETRIES) {
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }
        }

        // If we get here, all retries failed
        sendProgress({
            type: 'error',
            serialNumber,
            message: `Failed after ${MAX_RETRIES} attempts: ${lastError.message}`
        });

        return {
            serialNumber,
            status: "error",
            message: lastError.message,
            completed: index + 1,
            total
        };
    };

    try {
        const {
            equipmentPayloads = [],
            pdfData = {},
            checklistPayloads = [],
            abnormalCondition = "",
            voltageData = {},
        } = req.body;

        if (!Array.isArray(equipmentPayloads) || equipmentPayloads.length === 0) {
            sendProgress({
                type: 'error',
                message: 'No equipmentPayloads provided'
            });
            return res.end();
        }

        // 1) Get next installation report number
        sendProgress({ type: 'status', message: 'Generating installation report number...' });
        const counter = await InstallationReportCounter.findOneAndUpdate(
            { _id: 'installationReportId' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true, maxTimeMS: 5000 }
        );
        const newInstallationReportNo = `IR4000${counter.seq}`;
        sendProgress({ type: 'report-number', number: newInstallationReportNo });

        // 2) Generate Installation Report PDF (once for all equipment)
        sendProgress({ type: 'status', message: 'Generating installation report PDF...' });
        const dataForInstallationPDF = {
            ...pdfData,
            installationreportno: newInstallationReportNo,
            abnormalCondition,
            voltageData,
        };
        const installationHtml = getCertificateHTML(dataForInstallationPDF);

        let installationBuffer;
        try {
            // Simplified PDF options for better reliability
            installationBuffer = await createPdfBuffer(installationHtml, {
                format: "A4",
                orientation: "portrait",
                border: "5mm",
                timeout: 60000 // 60 seconds timeout
            });
            sendProgress({ type: 'status', message: 'Installation report PDF generated successfully' });
        } catch (err) {
            console.error("Error generating Installation PDF:", err);
            sendProgress({
                type: 'error',
                message: 'Failed to create Installation PDF',
                error: err.message
            });
            return res.end();
        }

        // 3) Process each equipment with concurrency control
        const results = [];
        const CONCURRENT_PROCESSES = 2; // Process 2 at a time to reduce load

        // Split equipment into chunks
        const equipmentChunks = [];
        for (let i = 0; i < equipmentPayloads.length; i += CONCURRENT_PROCESSES) {
            equipmentChunks.push(equipmentPayloads.slice(i, i + CONCURRENT_PROCESSES));
        }

        for (const chunk of equipmentChunks) {
            // Process each chunk in parallel
            const chunkResults = await Promise.all(
                chunk.map((equipment, i) =>
                    processEquipmentWithRetry(
                        equipment,
                        equipmentPayloads.indexOf(equipment),
                        equipmentPayloads.length,
                        installationBuffer,
                        newInstallationReportNo,
                        pdfData
                    )
                )
            );

            results.push(...chunkResults);

            // Send progress for each completed chunk
            chunkResults.forEach(result => {
                sendProgress({
                    type: 'equipment-complete',
                    ...result
                });
            });
        }

        // 4) Send customer email (only once with installation report)
        if (pdfData.email) {
            sendProgress({
                type: 'status',
                message: 'Sending email to customer...'
            });

            try {
                const customerMailOptions = {
                    from: process.env.EMAIL_FROM || "webadmin@skanray-access.com",
                    to: pdfData.email,
                    subject: "Your Installation Report",
                    text: "Thank you for choosing our services",
                    attachments: [{
                        filename: "InstallationReport.pdf",
                        content: installationBuffer
                    }],
                    // Important for large attachments
                    disableFileAccess: true,
                    disableUrlAccess: true
                };

                await transporter.sendMail(customerMailOptions);
                sendProgress({
                    type: 'status',
                    message: `Customer email sent to: ${pdfData.email}`
                });
            } catch (emailErr) {
                console.error('Failed to send customer email:', emailErr);
                sendProgress({
                    type: 'warning',
                    message: `Failed to send customer email: ${emailErr.message}`
                });
            }
        } else {
            sendProgress({
                type: 'warning',
                message: 'No customer email provided - skipping customer notification'
            });
        }

        // 5) Final completion message
        sendProgress({
            type: 'complete',
            message: 'Processing completed',
            installationReportNo: newInstallationReportNo,
            results
        });

    } catch (err) {
        console.error("Error in bulk processing:", err);
        sendProgress({
            type: 'error',
            message: `Fatal error: ${err.message}`
        });
    } finally {
        res.end();
    }
});









// UPDATE equipment
router.put('/equipment/:id', getEquipmentById, checkDuplicateSerialNumber, async (req, res) => {
    if (req.body.name != null) {
        res.equipment.name = req.body.name;
    }
    if (req.body.materialdescription != null) {
        res.equipment.materialdescription = req.body.materialdescription;
    }
    if (req.body.serialnumber != null) {
        res.equipment.serialnumber = req.body.serialnumber;
    }
    if (req.body.materialcode != null) {
        res.equipment.materialcode = req.body.materialcode;
    }
    if (req.body.status != null) {
        res.equipment.status = req.body.status;
    }
    if (req.body.currentcustomer != null) {
        res.equipment.currentcustomer = req.body.currentcustomer;
    }
    if (req.body.endcustomer != null) {
        res.equipment.endcustomer = req.body.endcustomer;
    }
    if (req.body.equipmentid != null) {
        res.equipment.equipmentid = req.body.equipmentid;
    }
    if (req.body.custWarrantystartdate != null) {
        res.equipment.custWarrantystartdate = req.body.custWarrantystartdate;
    }
    if (req.body.custWarrantyenddate != null) {
        res.equipment.custWarrantyenddate = req.body.custWarrantyenddate;
    }
    if (req.body.dealerwarrantystartdate != null) {
        res.equipment.dealerwarrantystartdate = req.body.dealerwarrantystartdate;
    }
    if (req.body.dealerwarrantyenddate != null) {
        res.equipment.dealerwarrantyenddate = req.body.dealerwarrantyenddate;
    }
    if (req.body.dealer != null) {
        res.equipment.dealer = req.body.dealer;
    }
    if (req.body.palnumber != null) {
        res.equipment.palnumber = req.body.palnumber;
    }

    try {
        const updatedEquipment = await res.equipment.save();
        res.json(updatedEquipment);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE equipment
router.delete('/equipment/:id', async (req, res) => {
    try {
        const deletedEquipment = await Equipment.deleteOne({ _id: req.params.id })
        if (deletedEquipment.deletedCount === 0) {
            res.status(404).json({ message: "Equipment Not Found" })
        }
        res.json({ message: 'Deleted Equipment' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/searchequipment', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const query = {
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { materialdescription: { $regex: q, $options: 'i' } },
                { serialnumber: { $regex: q, $options: 'i' } },
                { materialcode: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } },
                { currentcustomer: { $regex: q, $options: 'i' } },
                { dealer: { $regex: q, $options: 'i' } },
                { palnumber: { $regex: q, $options: 'i' } },
                { equipmentid: { $regex: q, $options: 'i' } }
            ]
        };

        const users = await Equipment.find(query);

        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
