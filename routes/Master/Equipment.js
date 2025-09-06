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
const PM = require('../../Model/UploadSchema/PMSchema');
const mongoose = require('mongoose');
const NotificationSettings = require('../../Model/AdminSchema/NotificationSettingsSchema');

async function getCicRecipients() {
    try {
        const settings = await NotificationSettings.findOne();
        if (settings && Array.isArray(settings.cicRecipients)) {
            // Filter out duplicates and validate email format
            const uniqueValidEmails = [...new Set(settings.cicRecipients)].filter(email =>
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            );
            return uniqueValidEmails;
        }
        return [];
    } catch (error) {
        console.error('Error fetching cicRecipients:', error);
        return [];
    }
}

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

        // Exclude Inactive equipment
        conditions.push({ status: { $ne: "Inactive" } });

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



// BULK DELETE Equipment entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/equipment/bulk', async (req, res) => {
    try {
        const { ids } = req.body;

        // Validate input
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Please provide valid IDs array' });
        }

        // Validate ObjectIds
        const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIds.length === 0) {
            return res.status(400).json({ message: 'No valid IDs provided' });
        }

        // Delete multiple equipment
        const deleteResult = await Equipment.deleteMany({
            _id: { $in: validIds }
        });

        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({
                message: 'No equipment found to delete',
                deletedCount: 0
            });
        }

        res.json({
            message: `Successfully deleted ${deleteResult.deletedCount} equipment`,
            deletedCount: deleteResult.deletedCount,
            requestedCount: validIds.length
        });

    } catch (err) {
        console.error('Bulk delete error:', err);
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
        const equipmentData = await Equipment.findOne({
            serialnumber: serialnumber,
            status: { $ne: "Inactive" }
        });

        if (!equipmentData) {
            return res.status(404).json({
                message: 'No equipment data found for the provided serial number'
            });
        }

        // 2. Using the material code from the equipment, find AMC contract data
        const materialCode = equipmentData.materialcode;

        const amcContract = await AMCContract.findOne(
            {
                materialcode: materialCode,
                status: { $ne: "Inactive" }
            },
            { startdate: 1, enddate: 1, _id: 0 }
        );

        const amcContractDates = amcContract
            ? { startdate: amcContract.startdate, enddate: amcContract.enddate }
            : {};


        // 3. Using the current customer code from the equipment, find customer details
        const customerCode = equipmentData.currentcustomer;
        const customerData = await Customer.findOne({ customercodeid: customerCode, status: { $ne: "Inactive" } });

        // ✅ Fixed: Properly structure customer details with all fields
        const customerDetails = customerData ? {
            customercodeid: customerData.customercodeid,
            customername: customerData.customername,
            hospitalname: customerData.hospitalname,
            street: customerData.street,
            city: customerData.city,
            postalcode: customerData.postalcode,
            district: customerData.district,
            state: customerData.state,
            region: customerData.region,
            country: customerData.country,
            telephone: customerData.telephone,
            taxnumber1: customerData.taxnumber1,
            taxnumber2: customerData.taxnumber2,
            email: customerData.email,
            status: customerData.status,
            customertype: customerData.customertype,
            createdAt: customerData.createdAt,
            modifiedAt: customerData.modifiedAt
        } : {};

        // 4. Find all equipments that have used this same customer code
        const customerEquipments = await Equipment.find(
            { currentcustomer: customerCode, status: { $ne: "Inactive" } },
            'serialnumber materialcode name materialdescription'
        );

        // 5. Combine the data and return it
        const combinedData = {
            equipment: equipmentData,
            amcContract: amcContractDates,
            customer: customerDetails,
            customerEquipments
        };

        return res.status(200).json({
            success: true,
            data: combinedData
        });

    } catch (err) {
        console.error('Error in equipment-details endpoint:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
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
        branchOrDealerCode = '',
        branchOrDealerName = '',
        city = '',
        usertype = '',
        userBranchCodes = [],
        managerEmails = [],
        userEmail,
    } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).send({ error: 'Products list is required' });
    }

    if (!userId || !userName || !employeeId) {
        return res.status(400).send({ error: 'User ID, user name, and employee ID are required' });
    }

    // Function to determine branch or dealer display based on usertype
    const getBranchOrDealerDisplay = () => {
        if (usertype === 'skanray') {
            // For Skanray users, show branch codes from userBranchCodes array
            if (Array.isArray(userBranchCodes) && userBranchCodes.length > 0) {
                return userBranchCodes.join(', ');
            } else {
                return 'NA';
            }
        } else if (usertype === 'dealer') {
            // For dealer users, show dealer code / dealer name / city
            const dealerCode = branchOrDealerCode && branchOrDealerCode.trim() !== '' ? branchOrDealerCode : 'NA';
            const dealerName = branchOrDealerName && branchOrDealerName.trim() !== '' ? branchOrDealerName : 'NA';
            const cityName = city && city.trim() !== '' ? city : 'NA';
            return `${dealerCode} / ${dealerName} / ${cityName}`;
        } else {
            return 'NA';
        }
    };

    const branchDealerDisplay = getBranchOrDealerDisplay();

    // Prepare recipient emails list from Notification Settings (Abort Installation Recipients)
    let emailsToSend = [];
    try {
        const settings = await NotificationSettings.findOne();
        if (settings && Array.isArray(settings.abortInstallationRecipients)) {
            emailsToSend = settings.abortInstallationRecipients.slice();
        }
    } catch (err) {
        console.error('Failed to fetch notification settings:', err);
    }

    // Add user email if provided
    if (userEmail) {
        emailsToSend.push(userEmail);
    }

    // Add manager emails from array
    if (Array.isArray(managerEmails) && managerEmails.length > 0) {
        for (const email of managerEmails) {
            if (email) emailsToSend.push(email);
        }
    }

    // De-duplicate and lightly validate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    emailsToSend = Array.from(new Set(
        emailsToSend
            .filter(Boolean)
            .map((e) => String(e).trim())
            .filter((e) => emailRegex.test(e))
    ));

    if (emailsToSend.length === 0) {
        return res.status(400).send({ error: 'No abort installation recipients configured' });
    }

    const mailOptions = {
        from: 'webadmin@skanray-access.com',
        to: emailsToSend.join(','),
        subject: 'Aborted Installation',
        html: `
    <div style="font-family: Arial, sans-serif; font-size: 14px; margin: 20px;">
        <p>Dear Team,</p>
        <p>Installation <strong>aborted</strong> for below products</p>

        <table style="border-collapse: collapse; width: 100%; max-width: 500px; font-size: 14px; font-family: Arial, sans-serif;">
            <thead>
                <tr>
                    <th style="background-color: #ffff00; padding: 8px 12px; border: 1px solid #000; text-align: left; width: 50px;">No</th>
                    <th style="background-color: #ffff00; padding: 8px 12px; border: 1px solid #000; text-align: left;">Product</th>
                    <th style="background-color: #ffff00; padding: 8px 12px; border: 1px solid #000; text-align: left; width: 150px;">Slno</th>
                </tr>
            </thead>
            <tbody>
                ${products.map((item, index) => `
                    <tr>
                        <td style="background-color: #ffff00; padding: 8px 12px; border: 1px solid #000; text-align: center; font-weight: bold;">${index + 1}</td>
                        <td style="background-color: #ffff00; padding: 8px 12px; border: 1px solid #000; font-weight: bold;">${item.name}</td>
                        <td style="background-color: #ffff00; padding: 8px 12px; border: 1px solid #000; font-weight: bold;">${item.slno}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <p style="margin-top: 20px;">
            by ( <span style="background-color: #ffff00; padding: 2px 4px; font-weight: bold;">${employeeId}</span> & <span style="background-color: #ffff00; padding: 2px 4px; font-weight: bold;">${userName}</span> ) <span style="background-color: #ffff00; padding: 2px 4px; font-weight: bold;">${usertype === 'skanray' ? 'Skanray branch' : 'Dealer code'}</span> , <span style="background-color: #ffff00; padding: 2px 4px; font-weight: bold;">${branchDealerDisplay}</span>
        </p>
    </div>
  `,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.send({
            message: 'Aborted installation email sent successfully',
            recipients: emailsToSend,
            productsCount: products.length,
            branchDealerDisplay: branchDealerDisplay,
            usertype: usertype
        });
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



// Send OTP Endpoint - Only backend logic enhanced, template unchanged
router.post('/send-otp', async (req, res) => {
    const {
        email,
        products,
        installationLocation,
        customerDetails,
        serviceEngineer
    } = req.body;

    if (!email) {
        return res.status(400).json({
            success: false,
            message: 'Email is required'
        });
    }

    try {
        // Generate a 4-digit OTP (matching your template format)
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        // Store OTP with a 5-minute expiry
        const expiryTime = Date.now() + 5 * 60 * 1000;
        otpStore[email] = {
            otp,
            expiresAt: expiryTime,
            createdAt: new Date().toISOString(),
            attempts: 0
        };

        // Create products warranty list for email template
        const warrantyList = products && products.length > 0
            ? products.map(product =>
                `${product.serialNumber}  ${product.description} Warranty from ${product.warrantyStartDate} to ${product.warrantyEndDate}`
            ).join('\n')
            : 'No products specified';

        // Create installation address
        const installationAddress = installationLocation?.formattedAddress ||
            `${customerDetails?.customerName || 'Customer Address'}\n${installationLocation?.city || ''}\n${installationLocation?.region || ''}`;

        // Your EXACT original HTML template - NO CHANGES
        const htmlTemplate = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
            <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
                <h3 style="margin: 0;">OTP Template Installation (Email)</h3>
                <p style="margin: 5px 0; font-size: 12px;">To be sent to customer's & Email selected during the Installation.</p>
                <p style="margin: 5px 0; font-weight: bold;">Subject: OTP for Installation.</p>
            </div>
            
            <p><strong>Dear Customer,</strong></p>
            
            <p><strong>Below products with warranty</strong></p>
            <div style="background-color: #ffff99; padding: 10px; margin: 10px 0; font-family: monospace;">
                ${warrantyList.split('\n').map(line => `<div>${line}</div>`).join('')}
            </div>
            
            <p><strong>will be installed at</strong></p>
            <div style="background-color: #ffff99; padding: 10px; margin: 10px 0; font-family: monospace;">
                ${installationAddress.split('\n').map(line => `<div>${line}</div>`).join('')}
            </div>
            
            <p>Kindly provide the Acceptance token ID /OTP (<strong style="color: #ff0000;">${otp}</strong>) to the service team acknowledging the installation and warranty terms.</p>
            <p>You will receive a digitally signed Installation report in your email</p>
            
            <p>Regards,<br/>
            Skanray Service Support team</p>
            
            <div style="border-top: 1px solid #333; margin-top: 30px; padding-top: 10px;">
                <p style="font-size: 12px; color: #666;">This OTP is valid for 5 minutes only.</p>
            </div>
        </div>
        `;

        // Your EXACT original plain text template - NO CHANGES
        const textTemplate = `
OTP Template Installation (Email)
To be sent to customer's & Email selected during the Installation.
Subject: OTP for Installation.

Dear Customer,

Below products with warranty
${warrantyList}

will be installed at
${installationAddress}

Kindly provide the Acceptance token ID /OTP (${otp}) to the service team acknowledging the installation and warranty terms.
You will receive a digitally signed Installation report in your email

Regards,
Skanray Service Support team

This OTP is valid for 5 minutes only.
        `;

        const mailOptions = {
            from: 'webadmin@skanray-access.com',
            to: email,
            subject: 'OTP for Installation',
            text: textTemplate,
            html: htmlTemplate
        };

        await transporter.sendMail(mailOptions);
        console.log(`OTP ${otp} sent to ${email} for installation`);

        res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            details: {
                email: email,
                otpSentAt: new Date().toISOString(),
                expiresAt: new Date(expiryTime).toISOString(),
                productsCount: products?.length || 0,
                customerName: customerDetails?.customerName || 'N/A'
            }
        });

    } catch (error) {
        console.error('Failed to send OTP email:', error);

        // Remove failed OTP from store
        if (otpStore[email]) {
            delete otpStore[email];
        }

        res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: error.message
        });
    }
});

// Verify OTP Endpoint - Enhanced with proper expiry handling
router.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    // Input validation
    if (!email || !otp) {
        return res.status(400).json({
            success: false,
            message: 'Email and OTP are required',
            code: 'MISSING_FIELDS'
        });
    }

    // Check if OTP record exists
    const record = otpStore[email];
    if (!record) {
        return res.status(400).json({
            success: false,
            message: 'No OTP found for this email. Please request a new OTP.',
            code: 'OTP_NOT_FOUND',
            expired: true
        });
    }

    // Check if OTP has expired (5 minutes)
    const currentTime = Date.now();
    if (currentTime > record.expiresAt) {
        // Remove expired OTP from store
        delete otpStore[email];

        return res.status(400).json({
            success: false,
            message: 'OTP has expired. Please request a new OTP.',
            code: 'OTP_EXPIRED',
            expired: true,
            expiredAt: new Date(record.expiresAt).toISOString()
        });
    }

    // Increment attempt counter
    record.attempts = (record.attempts || 0) + 1;

    // Check for too many attempts (security feature)
    if (record.attempts > 5) {
        delete otpStore[email];
        return res.status(400).json({
            success: false,
            message: 'Too many failed attempts. Please request a new OTP.',
            code: 'TOO_MANY_ATTEMPTS',
            expired: true
        });
    }

    // Verify OTP
    if (record.otp !== otp) {
        const remainingTime = Math.ceil((record.expiresAt - currentTime) / (60 * 1000));

        return res.status(400).json({
            success: false,
            message: 'Invalid OTP. Please try again.',
            code: 'INVALID_OTP',
            expired: false,
            attemptsRemaining: Math.max(0, 5 - record.attempts),
            timeRemaining: remainingTime
        });
    }

    // OTP is valid - remove from store to prevent reuse
    delete otpStore[email];

    console.log(`✅ OTP verified successfully for ${email}`);

    res.status(200).json({
        success: true,
        message: 'OTP verified successfully',
        verifiedAt: new Date().toISOString()
    });
});

// Optional: Cleanup expired OTPs periodically (prevents memory leaks)
setInterval(() => {
    const now = Date.now();
    Object.keys(otpStore).forEach(email => {
        if (otpStore[email].expiresAt < now) {
            delete otpStore[email];
            console.log(`Cleaned up expired OTP for ${email}`);
        }
    });
}, 60 * 1000); // Run every minute

module.exports = router;


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
            // PM Documents from PMDocMaster (exclude Inactive)
            PMDocMaster.find({
                productGroup: productGroup,
                type: 'IN',
                status: { $ne: "Inactive" }
            }).select('chlNo revNo type status createdAt modifiedAt'),

            // Format Documents from FormatMaster (exclude Inactive)
            FormatMaster.find({
                productGroup: productGroup,
                type: 'IN',
                status: { $ne: "Inactive" }
            }).select('chlNo revNo type status createdAt updatedAt')
        ]);

        res.json({
            success: true,
            productGroup,
            documents: pmDocs.map(doc => ({
                chlNo: doc.chlNo,
                revNo: doc.revNo,
            })),
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

        // Phase 2: Installation PDF Generation (only once)
        response.currentPhase = 'installation-pdf-generation';
        sendUpdate(response);

        // 🔥 FIX: Create enhanced equipment list with keys from equipmentPayloads
        const enhancedEquipmentList = equipmentPayloads.map(equipment => ({
            materialdescription: equipment.materialdescription || "",
            serialnumber: equipment.serialnumber || "",
            custWarrantyenddate: equipment.custWarrantyenddate || "",
            key: equipment.key || "",
            materialcode: equipment.materialcode || ""
        }));

        // 🔥 FIX: Extract palnumber from first equipment payload
        const palnumber = equipmentPayloads[0]?.palnumber || "";

        console.log('Enhanced Equipment List with Keys:', enhancedEquipmentList);
        console.log('Extracted palnumber:', palnumber);

        const installationHtml = getCertificateHTML({
            ...pdfData,
            equipmentList: enhancedEquipmentList,
            installationreportno: reportNo,
            abnormalCondition: req.body.abnormalCondition || "",
            voltageData: req.body.voltageData || {},
            palnumber: palnumber, // 🔥 FIX: Pass the palnumber here
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

        // Phase 3: Equipment Processing and Checklist Generation
        response.currentPhase = 'equipment-processing';
        sendUpdate(response);

        // 🔥 FIX: Separate attachments for customer and internal emails
        const customerAttachments = [{
            filename: `InstallationReport_${reportNo}.pdf`,
            content: installationBuffer
        }];

        const internalAttachments = [{
            filename: `InstallationReport_${reportNo}.pdf`,
            content: installationBuffer
        }];

        // Create a list to track all serial numbers for email subject
        const serialNumbers = [];

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
                    serialNumbers.push(serialNumber);
                    response.processedRecords++;

                    // Find matching checklist and enhance it with equipment data
                    const checklist = checklistPayloads.find(cp => cp.serialNumber === serialNumber);

                    // Create enhanced checklist data
                    const enhancedChecklist = checklist ? {
                        ...checklist,
                        equipmentUsedSerial: equipment.equipmentUsedSerial || "",
                        calibrationDueDate: equipment.calibrationDueDate || "",
                        checklistResults: checklist.checklistResults?.map((item, index) => ({
                            ...item,
                            ...(index === 0 ? {
                                equipmentUsedSerial: equipment.equipmentUsedSerial || "",
                                calibrationDueDate: equipment.calibrationDueDate || ""
                            } : {})
                        })) || []
                    } : null;

                    // Generate checklist PDF if exists
                    if (enhancedChecklist?.checklistResults?.length > 0) {
                        const formatDetails = enhancedChecklist.prodGroup ?
                            await FormatMaster.findOne({ productGroup: enhancedChecklist.prodGroup }) :
                            null;

                        const documentInfo = enhancedChecklist.documentInfo;

                        let documentChlNo = "N/A";
                        let documentRevNo = "N/A";
                        let formatChlNo = "N/A";
                        let formatRevNo = "N/A";

                        if (formatDetails) {
                            formatChlNo = formatDetails.chlNo || "N/A";
                            formatRevNo = formatDetails.revNo || "N/A";
                        }

                        if (documentInfo) {
                            if (documentInfo.formats && documentInfo.formats.length > 0) {
                                formatChlNo = documentInfo.formats[0].chlNo || formatChlNo;
                                formatRevNo = documentInfo.formats[0].revNo || formatRevNo;
                            }

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
                                equipmentUsed: equipment.equipmentUsedSerial || "",
                                calibrationDueDate: equipment.calibrationDueDate || ""
                            },
                            remarkglobal: enhancedChecklist.globalRemark || "",
                            checklistItems: enhancedChecklist.checklistResults,
                            serviceEngineer: `${pdfData.userInfo?.firstName || ""} ${pdfData.userInfo?.lastName || ""}`,
                            documentChlNo,
                            documentRevNo,
                            formatChlNo,
                            formatRevNo,
                            userInfo: pdfData.userInfo, // Add userInfo parameter for service engineer details
                        });

                        const checklistBuffer = await generateSimplePdf(checklistHtml);
                        if (checklistBuffer) {
                            // 🔥 FIX: Add checklist only to internal attachments, not customer
                            internalAttachments.push({
                                filename: `Checklist_${serialNumber}.pdf`,
                                content: checklistBuffer
                            });
                        }
                    }

                    // Update equipment in database with the calibration and equipment info
                    await Equipment.findOneAndUpdate(
                        { serialnumber: serialNumber },
                        {
                            $set: {
                                equipmentUsedSerial: equipment.equipmentUsedSerial || "",
                                calibrationDueDate: equipment.calibrationDueDate || "",
                                key: equipment.key || ""
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

        // Phase 4: Send Emails with Different Attachments
        response.currentPhase = 'sending-email';
        sendUpdate(response);

        const serialNumbersText = serialNumbers.join(', ');
        const customerEmailSubject = `Installation Report ${reportNo} - Equipment: ${serialNumbersText}`;
        const customerEmailText = `Please find attached the installation report for the following equipment serial numbers: ${serialNumbersText}`;

        const internalEmailSubject = `Installation Report ${reportNo} with Checklists - Equipment: ${serialNumbersText}`;
        const internalEmailText = `Please find attached the installation report and checklists for the following equipment serial numbers: ${serialNumbersText}`;

        try {
            // 🔥 FIX: 1. Send ONLY Installation Report to customer's email
            if (pdfData.email) {
                await transporter.sendMail({
                    from: 'webadmin@skanray-access.com',
                    to: pdfData.email,
                    subject: customerEmailSubject,
                    text: customerEmailText,
                    attachments: customerAttachments, // Only installation report
                    disableFileAccess: true,
                    disableUrlAccess: true
                });
            }
            const cicRecipients = await getCicRecipients();

            // 🔥 FIX: 2. Send Installation Report + Checklists to internal emails
            if (pdfData.userInfo) {
                const toEmails = [
                    pdfData.userInfo?.dealerEmail,
                    pdfData.userInfo?.email,
                    ...(Array.isArray(pdfData.userInfo.manageremail)
                        ? pdfData.userInfo.manageremail
                        : pdfData.userInfo.manageremail
                            ? [pdfData.userInfo.manageremail]
                            : []),
                    ...cicRecipients  // CIC recipients from database
                ].filter(Boolean);

                if (toEmails.length > 0) {
                    await transporter.sendMail({
                        from: 'webadmin@skanray-access.com',
                        to: toEmails,
                        subject: internalEmailSubject,
                        text: internalEmailText,
                        attachments: internalAttachments, // Installation report + checklists
                        disableFileAccess: true,
                        disableUrlAccess: true
                    });
                }
            }
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            response.errors.push(`Email sending failed: ${emailError.message}`);
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
    // Track if status changed
    let statusChanged = false;
    if (req.body.status != null && req.body.status !== res.equipment.status) {
        statusChanged = true;
    }

    // Update equipment fields as before
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

        // NEW: If status changed, update related PM documents
        if (statusChanged) {
            const serialNumber = updatedEquipment.serialnumber;

            if (serialNumber) {
                const pmUpdateResult = await PM.updateMany(
                    { serialNumber: serialNumber },
                    { $set: { status: req.body.status } }
                );

                console.log(`Updated ${pmUpdateResult.modifiedCount} PM records for serial ${serialNumber} to status ${req.body.status}`);
            }
        }

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
