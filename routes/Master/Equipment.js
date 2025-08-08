const express = require('express');
const router = express.Router();
const Equipment = require('../../Model/MasterSchema/EquipmentSchema');
const PendingInstallation = require('../../Model/UploadSchema/PendingInstallationSchema'); // Adjust the path based on your folder structure
const nodemailer = require('nodemailer');
const pdf = require('html-pdf');
const { Readable } = require('stream');
const FormatMaster = require("../../Model/MasterSchema/FormatMasterSchema");
const { getChecklistHTML } = require("./getChecklistHTML"); // the new function above
const EquipmentChecklist = require('../../Model/CollectionSchema/EquipmentChecklistSchema');
const User = require('../../Model/MasterSchema/UserSchema');
const InstallationReportCounter = require('../../Model/MasterSchema/InstallationReportCounterSchema');
const puppeteer = require('puppeteer');
const getCertificateHTML = require('./certificateTemplate'); // Our HTML template function
const AMCContract = require('../../Model/UploadSchema/AMCContractSchema');
const Customer = require('../../Model/UploadSchema/CustomerSchema'); // Adjust the path as necessary
const Product = require('../../Model/MasterSchema/ProductSchema');
const PMDocMaster = require('../../Model/MasterSchema/pmDocMasterSchema');



// In-memory OTP store (for demonstration; consider a persistent store in production)
const otpStore = {};
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'webadmin@skanray-access.com',
        pass: 'rdzegwmzirvbjcpm'
    }
});



const createPdfBuffer = async (html) => {
    const launchOptions = {
        headless: 'new', // Use new Headless mode
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            // '--single-process',
        ],
        timeout: 30000,
    };

    // Set executable path for production if needed
    if (process.env.NODE_ENV === 'production') {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
            '/usr/bin/chromium-browser' ||
            '/usr/bin/google-chrome-stable';
    }

    let browser;
    try {
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();

        // Set longer timeout for content loading
        await page.setDefaultNavigationTimeout(60000);

        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        return await page.pdf({
            format: 'A4',
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            },
            printBackground: true,
        });
    } catch (error) {
        console.error('PDF generation error:', error);
        throw new Error('PDF generation failed');
    } finally {
        if (browser) await browser.close();
    }
};
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
        const { search, limit = 100 } = req.query;

        const conditions = [];

        // Exclude empty or null serialnumbers
        conditions.push({ serialnumber: { $ne: "" } });

        // Add search condition if provided
        if (search && search.trim()) {
            conditions.push({
                serialnumber: {
                    $regex: search.trim(),
                    $options: 'i' // Case-insensitive
                }
            });
        }

        const query = conditions.length > 0 ? { $and: conditions } : {};

        const equipment = await Equipment
            .find(query, 'serialnumber')
            .limit(parseInt(limit))
            .sort({ serialnumber: 1 });

        const serialNumbers = equipment.map(item => item.serialnumber);

        res.json({
            serialNumbers,
            count: serialNumbers.length,
            hasMore: serialNumbers.length === parseInt(limit)
        });

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


router.post('/abort-installation', async (req, res) => {
    const {
        products,
        userId,
        userName,
        employeeId,
        branchOrDealerCode,
        branchOrDealerName,
        city,
    } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).send({ error: 'Products list is required' });
    }

    if (!userId || !userName || !branchOrDealerCode || !branchOrDealerName || !city) {
        return res.status(400).send({ error: 'User and branch/dealer details are required' });
    }

    let productListText = '';
    products.forEach((product, index) => {
        productListText += `${index + 1}  ${product.name}  ${product.slno}\n`;
    });
    const dealerCodeHtml = branchOrDealerCode
        ? `Dealer code - <strong>${branchOrDealerCode}</strong>, `
        : '';

    const mailOptions = {
        from: 'webadmin@skanray-access.com',
        to: 'shivamt2023@gmail.com',
        subject: 'Aborted Installation',
        html: `
    <div style="font-family: Arial, sans-serif; font-size: 14px;">
        <p>Dear Team,</p>
        <p>Installation aborted for below products:</p>

        <table style="border-collapse: collapse; width: 70%; margin-bottom: 18px; font-size: 14px; font-family: Arial, sans-serif;">
            <thead>
                <tr>
                    <th style="background-color: #ffff00; padding: 8px 20px; border: 1px solid #888;">No</th>
                    <th style="background-color: #ffff00; padding: 8px 20px; border: 1px solid #888;">Product</th>
                    <th style="background-color: #ffff00; padding: 8px 20px; border: 1px solid #888;">Slno</th>
                </tr>
            </thead>
            <tbody>
                ${products.map((item, index) => `
                    <tr>
                        <td style="background-color: #ffff00; padding: 6px 18px; border: 1px solid #888; text-align: center;">${index + 1}</td>
                        <td style="background-color: #ffff00; padding: 6px 18px; border: 1px solid #888;">${item.name}</td>
                        <td style="background-color: #ffff00; padding: 6px 18px; border: 1px solid #888;">${item.slno}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <p style="background-color: #ffff00; padding: 8px 12px; display: inline-block; border-radius: 4px;">
            by (<strong>${employeeId}</strong> - <strong>${userName}</strong><br>)${dealerCodeHtml}<strong>${city}</strong>
        </p>
    </div>
  `,
    };




    try {
        await transporter.sendMail(mailOptions);
        res.send({ message: 'Aborted installation email sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).send({ error: 'Failed to send email' });
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
        from: 'webadmin@skanray-access.com',
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


// Usage remains the same as before
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
router.get('/informatedoc/by-part/:partnoid', async (req, res) => {
    try {
        const partnoid = req.params.partnoid;

        // Step 1: Find the product using partnoid
        const product = await Product.findOne({ partnoid });
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found for the provided part number'
            });
        }

        // Step 2: Extract product group
        const productGroup = product.productgroup;

        // Step 3: Find documents from PMDocMaster (PM type) and FormatMaster
        const [pmDocs, formatDocs] = await Promise.all([
            // PM Documents from PMDocMaster
            PMDocMaster.find({
                productGroup: productGroup,
                type: 'IN'
            }).select('chlNo revNo type status createdAt modifiedAt'),

            // Format Documents from FormatMaster
            FormatMaster.find({
                productGroup: productGroup,
                type: 'IN'
            }).select('chlNo revNo type status createdAt updatedAt')
        ]);

        res.json({
            success: true,
            productGroup,
            // PM Documents from PMDocMaster in 'documents' array
            documents: pmDocs.map(doc => ({
                chlNo: doc.chlNo,
                revNo: doc.revNo,
            })),
            // Format Documents from FormatMaster in 'formats' array
            formats: formatDocs.map(doc => ({
                chlNo: doc.chlNo,
                revNo: doc.revNo,

            }))
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

router.post("/equipment/bulk", async (req, res) => {
    const response = {
        status: 'processing',
        startTime: new Date(),
        totalRecords: 0,
        processedRecords: 0,
        equipmentResults: [],
        summary: {
            totalExpected: 0,
            totalCreated: 0,
            completionPercentage: 0
        },
        errors: [],
        currentPhase: 'initializing'
    };

    try {
        // Disable compression and set streaming headers
        res.removeHeader('Content-Encoding');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const sendUpdate = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
            if (typeof res.flush === 'function') {
                res.flush();
            }
        };

        if (!req.body.equipmentPayloads) {
            response.status = 'failed';
            response.errors.push('No equipment payloads provided');
            sendUpdate(response);
            return res.end();
        }

        const { equipmentPayloads = [], pdfData = {}, checklistPayloads = [] } = req.body;
        response.totalRecords = equipmentPayloads.length;
        response.summary.totalExpected = equipmentPayloads.length;

        // Send initial response
        sendUpdate(response);

        // Phase 1: Report Number Generation
        response.currentPhase = 'report-number-generation';
        sendUpdate(response);

        const counter = await InstallationReportCounter.findOneAndUpdate(
            { _id: 'installationReportId' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        const reportNo = `IR4000${counter.seq}`;
        sendUpdate(response);

        // Phase 2: Installation PDF Generation
        response.currentPhase = 'installation-pdf-generation';
        sendUpdate(response);

        const installationHtml = getCertificateHTML({
            ...pdfData,
            installationreportno: reportNo,
            abnormalCondition: req.body.abnormalCondition || "",
            voltageData: req.body.voltageData || {},
            // Include equipment used and calibration date in the PDF
            equipmentUsedSerial: equipmentPayloads[0]?.equipmentUsedSerial || "",
            calibrationDueDate: equipmentPayloads[0]?.calibrationDueDate || ""
        });

        const installationBuffer = await generateSimplePdf(installationHtml);
        if (!installationBuffer) {
            response.status = 'failed';
            response.errors.push('Failed to generate installation PDF');
            sendUpdate(response);
            return res.end();
        }
        sendUpdate(response);

        // Phase 3: Equipment Processing
        response.currentPhase = 'equipment-processing';
        sendUpdate(response);

        // Process in small batches for better streaming
        const BATCH_SIZE = 3;
        for (let i = 0; i < equipmentPayloads.length; i += BATCH_SIZE) {
            const batch = equipmentPayloads.slice(i, i + BATCH_SIZE);

            for (const equipment of batch) {
                const equipmentResult = {
                    serialnumber: equipment.serialnumber || 'Unknown',
                    status: 'Processing',
                    error: null
                };

                try {
                    const serialNumber = equipment.serialnumber;
                    response.processedRecords++;

                    // Find matching checklist and enhance it with equipment data
                    const checklist = checklistPayloads.find(cp => cp.serialNumber === serialNumber);

                    // Create enhanced checklist data
                    const enhancedChecklist = checklist ? {
                        ...checklist,
                        // Add equipment used and calibration date to the checklist
                        equipmentUsedSerial: equipment.equipmentUsedSerial || "",
                        calibrationDueDate: equipment.calibrationDueDate || "",
                        // Ensure these fields are included in the first checklist item
                        checklistResults: checklist.checklistResults?.map((item, index) => ({
                            ...item,
                            // Only include in first item to avoid duplication
                            ...(index === 0 ? {
                                equipmentUsedSerial: equipment.equipmentUsedSerial || "",
                                calibrationDueDate: equipment.calibrationDueDate || ""
                            } : {})
                        })) || []
                    } : null;

                    // Generate checklist PDF if exists
                    let checklistBuffer = null;
                    if (enhancedChecklist?.checklistResults?.length > 0) {
                        const formatDetails = enhancedChecklist.prodGroup ?
                            await FormatMaster.findOne({ productGroup: enhancedChecklist.prodGroup }) :
                            null;

                        // Get document information from checklist payload
                        const documentInfo = enhancedChecklist.documentInfo;

                        // Extract document and format details
                        let documentChlNo = "N/A";
                        let documentRevNo = "N/A";
                        let formatChlNo = "N/A";
                        let formatRevNo = "N/A";

                        // Set format details from FormatMaster (existing logic)
                        if (formatDetails) {
                            formatChlNo = formatDetails.chlNo || "N/A";
                            formatRevNo = formatDetails.revNo || "N/A";
                        }

                        // Override with document info if available
                        if (documentInfo) {
                            // Use formats from document info if available
                            if (documentInfo.formats && documentInfo.formats.length > 0) {
                                formatChlNo = documentInfo.formats[0].chlNo || formatChlNo;
                                formatRevNo = documentInfo.formats[0].revNo || formatRevNo;
                            }

                            // Use documents from document info if available
                            if (documentInfo.documents && documentInfo.documents.length > 0) {
                                documentChlNo = documentInfo.documents[0].chlNo || "N/A";
                                documentRevNo = documentInfo.documents[0].revNo || "N/A";
                            }
                        }

                        const checklistHtml = getChecklistHTML({
                            reportNo,
                            date: pdfData.dateOfInstallation || new Date().toLocaleDateString("en-GB"),
                            customer: {
                                hospitalname: pdfData.hospitalName || "",
                                customername: pdfData.customerName || "",
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
                                // Include equipment used and calibration date in the checklist PDF
                                equipmentUsed: equipment.equipmentUsedSerial || "",
                                calibrationDueDate: equipment.calibrationDueDate || ""
                            },
                            remarkglobal: enhancedChecklist.globalRemark || "",
                            checklistItems: enhancedChecklist.checklistResults,
                            serviceEngineer: `${pdfData.userInfo?.firstName || ""} ${pdfData.userInfo?.lastName || ""}`,
                            // Document information
                            documentChlNo,
                            documentRevNo,
                            // Format information
                            formatChlNo,
                            formatRevNo,
                        });

                        checklistBuffer = await generateSimplePdf(checklistHtml);
                    }

                    // Email attachments
                    const attachments = [{
                        filename: `InstallationReport_${reportNo}.pdf`,
                        content: installationBuffer
                    }];

                    if (checklistBuffer) {
                        attachments.push({
                            filename: `Checklist_${serialNumber}.pdf`,
                            content: checklistBuffer
                        });
                    }

                    // 1. First send email to customer's email from pdfData
                    if (pdfData.email) {
                        await transporter.sendMail({
                            from: 'webadmin@skanray-access.com',
                            to: pdfData.email,
                            subject: `Installation Report ${reportNo} - ${serialNumber}`,
                            text: `Please find attached the installation report and checklist for equipment with serial number ${serialNumber}`,
                            attachments: attachments,
                            disableFileAccess: true,
                            disableUrlAccess: true
                        });
                    }

                    // 2. Then send email to dealer's email and user's email from userInfo
                    if (pdfData.userInfo) {
                        const toEmails = [
                            pdfData.userInfo?.dealerEmail,
                            pdfData.userInfo?.email,
                            ...(Array.isArray(pdfData.userInfo.manageremail)
                                ? pdfData.userInfo.manageremail
                                : pdfData.userInfo.manageremail
                                    ? [pdfData.userInfo.manageremail]
                                    : []),
                            'ftshivamtiwari222@gmail.com',
                            // 'Damodara.s@skanray.com'
                        ].filter(Boolean);

                        if (toEmails.length > 0) {
                            await transporter.sendMail({
                                from: 'webadmin@skanray-access.com',
                                to: toEmails,
                                subject: `Installation Report ${reportNo} - ${serialNumber}`,
                                text: `Please find attached the installation report and checklist for equipment with serial number ${serialNumber}`,
                                attachments: attachments,
                                disableFileAccess: true,
                                disableUrlAccess: true
                            });
                        }
                    }

                    // Update equipment in database with the calibration and equipment info
                    await Equipment.findOneAndUpdate(
                        { serialnumber: serialNumber },
                        {
                            $set: {
                                equipmentUsedSerial: equipment.equipmentUsedSerial || "",
                                calibrationDueDate: equipment.calibrationDueDate || ""
                            }
                        },
                        { new: true }
                    );

                    equipmentResult.status = 'Completed';
                    response.summary.totalCreated++;
                } catch (err) {
                    equipmentResult.status = 'Failed';
                    equipmentResult.error = err.message;
                    response.errors.push(`Error processing ${equipment.serialnumber}: ${err.message}`);
                }

                response.equipmentResults.push(equipmentResult);
                response.summary.completionPercentage = response.totalRecords > 0
                    ? Math.round((response.processedRecords / response.totalRecords) * 100)
                    : 100;

                sendUpdate(response);
            }
        }

        // Finalize response
        response.status = 'completed';
        response.endTime = new Date();
        response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;
        sendUpdate(response);
        res.end();

    } catch (error) {
        console.error('Bulk equipment upload error:', error);
        response.status = 'failed';
        response.endTime = new Date();
        response.errors.push(error.message);
        response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;
        sendUpdate(response);
        res.end();
    }
});



// UPDATE equipment
router.put('/equipment/:id', getEquipmentById, async (req, res) => {
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
    if (req.body.installationreportno != null) {
        res.equipment.installationreportno = req.body.installationreportno;
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

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
                { equipmentid: { $regex: q, $options: 'i' } },
                { installationreportno: { $regex: q, $options: 'i' } }
            ]
        };

        const equipment = await Equipment.find(query).skip(skip).limit(limit);
        const totalEquipment = await Equipment.countDocuments(query);
        const totalPages = Math.ceil(totalEquipment / limit);

        res.json({
            equipment,
            totalPages,
            totalEquipment,
            currentPage: page,
            isSearch: true
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


module.exports = router;
