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
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const getCertificateHTML = require('./certificateTemplate'); // Our HTML template function
const AMCContract = require('../../Model/UploadSchema/AMCContractSchema');
const Customer = require('../../Model/UploadSchema/CustomerSchema'); // Adjust the path as necessary


// Configure PDF options for Digital Ocean compatibility
const pdfOptions = {
    format: 'A4',
    orientation: 'portrait',
    border: '10mm',
    timeout: 120000, // 2 minutes timeout
    childProcessOptions: {
        env: {
            ...process.env,
            OPENSSL_CONF: '/dev/null',
            FONTCONFIG_PATH: '/etc/fonts',
            NODE_OPTIONS: '--max-old-space-size=512'
        }
    }
};



// In-memory OTP store (for demonstration; consider a persistent store in production)
const otpStore = {};
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'webadmin@skanray-access.com',
        pass: 'rdzegwmzirvbjcpm'
    }
});
const DEBUG = process.env.PDF_DEBUG === 'true';

const createPdfBuffer = async (html) => {
    // Configure launch options for production
    const launchOptions = {
        headless: true,
        executablePath: '/usr/bin/chromium-browser',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--single-process'
        ],
        timeout: 30000
    };

    let browser;
    try {
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        
        // Set HTML content with longer timeout
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        // Generate PDF with proper margins
        const pdf = await page.pdf({
            format: 'A4',
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            },
            printBackground: true,
            timeout: 60000
        });

        return pdf;
    } catch (error) {
        console.error('PDF generation error:', error);
        
        // Fallback attempt with simplified settings
        try {
            if (!browser) {
                browser = await puppeteer.launch({
                    ...launchOptions,
                    args: [...launchOptions.args, '--disable-extensions']
                });
            }
            
            const page = await browser.newPage();
            await page.setContent('<h1>Simplified Report</h1>' + html.substring(0, 2000), {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            return await page.pdf({
                format: 'A4',
                margin: '10mm',
                timeout: 30000
            });
        } catch (fallbackError) {
            console.error('Fallback PDF generation failed:', fallbackError);
            throw new Error('PDF generation failed after fallback attempt');
        }
    } finally {
        if (browser) await browser.close();
    }
};

// function createPdfBuffer(htmlContent, options = {}) {
//     return new Promise((resolve, reject) => {
//         pdf.create(htmlContent, options).toBuffer((err, buffer) => {
//             if (err) return reject(err);
//             resolve(buffer);
//         });
//     });
// }
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


const generateSimplePdf = async (html) => {
    try {
        const buffer = await createPdfBuffer(html);
        if (!buffer || buffer.length < 100) {
            throw new Error('Generated PDF is invalid');
        }
        return buffer;
    } catch (error) {
        console.error('PDF generation failed:', error);
        return null;
    }
};

router.post("/equipment/bulk", async (req, res) => {
    // Set headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    const sendUpdate = (data) => {
        try {
            res.write(JSON.stringify(data) + "\n");
            res.flush();
        } catch (err) {
            console.error('Failed to send update:', err);
        }
    };

    try {
        const { equipmentPayloads = [], pdfData = {}, checklistPayloads = [] } = req.body;

        // Validate input
        if (!Array.isArray(equipmentPayloads) || equipmentPayloads.length === 0) {
            return sendUpdate({
                status: "error",
                message: "No equipment payloads provided",
                timestamp: new Date().toISOString()
            });
        }

        // Generate report number
        sendUpdate({
            status: "progress",
            message: "Generating report number...",
            timestamp: new Date().toISOString()
        });

        const counter = await InstallationReportCounter.findOneAndUpdate(
            { _id: 'installationReportId' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        const reportNo = `IR4000${counter.seq}`;

        sendUpdate({
            status: "progress",
            message: "Report number generated",
            reportNo,
            timestamp: new Date().toISOString()
        });

        // Generate installation PDF
        sendUpdate({
            status: "progress",
            message: "Generating installation PDF...",
            timestamp: new Date().toISOString()
        });

        const installationHtml = getCertificateHTML({
            ...pdfData,
            installationreportno: reportNo,
            abnormalCondition: req.body.abnormalCondition || "",
            voltageData: req.body.voltageData || {}
        });

        const installationBuffer = await generateSimplePdf(installationHtml);
        if (!installationBuffer) {
            return sendUpdate({
                status: "error",
                message: "Failed to generate installation PDF",
                timestamp: new Date().toISOString()
            });
        }

        sendUpdate({
            status: "progress",
            message: "Installation PDF generated successfully",
            timestamp: new Date().toISOString()
        });

        // Process equipment sequentially
        for (const [index, equipment] of equipmentPayloads.entries()) {
            const serialNumber = equipment.serialnumber;

            try {
                sendUpdate({
                    status: "progress",
                    message: `Processing equipment ${index + 1}/${equipmentPayloads.length}`,
                    serialNumber,
                    timestamp: new Date().toISOString()
                });

                // Find matching checklist
                const checklist = checklistPayloads.find(cp => cp.serialNumber === serialNumber);

                // Generate checklist PDF if exists
                let checklistBuffer = null;
                if (checklist?.checklistResults?.length > 0) {
                    const formatDetails = checklist.prodGroup ?
                        await FormatMaster.findOne({ productGroup: checklist.prodGroup }) :
                        null;

                    const checklistHtml = getChecklistHTML({
                        reportNo,
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
                            serialNumber,
                            machineId: "",
                        },
                        remarkglobal: checklist.globalRemark || "",
                        checklistItems: checklist.checklistResults,
                        serviceEngineer: `${pdfData.userInfo?.firstName || ""} ${pdfData.userInfo?.lastName || ""}`,
                        formatChlNo: formatDetails?.chlNo || "",
                        formatRevNo: formatDetails?.revNo || "",
                    });

                    checklistBuffer = await generateSimplePdf(checklistHtml);
                }

                // Send email to CIC
                const cicUser = await User.findOne({
                    'role.roleName': 'CIC',
                    'role.roleId': 'C1'
                });

                if (cicUser) {
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

                    await transporter.sendMail({
                        from: process.env.EMAIL_FROM || "webadmin@skanray-access.com",
                        to: cicUser.email,
                        subject: `Installation Report - ${serialNumber}`,
                        text: `Equipment processed: ${serialNumber}`,
                        attachments: cicAttachments,
                        disableFileAccess: true,
                        disableUrlAccess: true
                    });
                }

                sendUpdate({
                    status: "success",
                    message: "Equipment processed successfully",
                    serialNumber,
                    completed: index + 1,
                    total: equipmentPayloads.length,
                    timestamp: new Date().toISOString()
                });

            } catch (err) {
                console.error(`Error processing ${serialNumber}:`, err);
                sendUpdate({
                    status: "error",
                    message: "Equipment processing failed",
                    error: err.message,
                    serialNumber,
                    completed: index + 1,
                    total: equipmentPayloads.length,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Final completion message
        sendUpdate({
            status: "complete",
            message: "All equipment processed",
            reportNo,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error("Fatal error in bulk processing:", err);
        sendUpdate({
            status: "error",
            message: "Bulk processing failed",
            error: err.message,
            timestamp: new Date().toISOString()
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
