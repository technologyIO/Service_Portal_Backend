const express = require('express');
const router = express.Router();
const Equipment = require('../../Model/MasterSchema/EquipmentSchema');
const PendingInstallation = require('../../Model/UploadSchema/PendingInstallationSchema'); // Adjust the path based on your folder structure
const nodemailer = require('nodemailer');
const pdf = require('html-pdf');
const FormatMaster = require("../../Model/MasterSchema/FormatMasterSchema");
const { getChecklistHTML } = require("./getChecklistHTML"); // the new function above
const EquipmentChecklist = require('../../Model/CollectionSchema/EquipmentChecklistSchema');

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
            'serialnumber materialcode name'
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

router.post("/equipment/bulk", async (req, res) => {
    try {
        const {
            equipmentPayloads = [],
            pdfData = {},
            checklistPayloads = [],
            abnormalCondition = "",
            voltageData = {},
        } = req.body;

        if (!Array.isArray(equipmentPayloads) || equipmentPayloads.length === 0) {
            return res.status(400).json({ message: "No equipmentPayloads provided." });
        }

        console.log("PDF data received for PDF creation (bulk):", pdfData);
        console.log("Checklist payloads:", checklistPayloads);
        console.log("abnormalCondition:", abnormalCondition);
        console.log("voltageData:", voltageData);

        // 1) Determine the next Installation Report Number
        const lastEquipment = await Equipment.findOne({
            installationreportno: { $regex: /^IR4000\d+$/ },
        })
            .sort({ createdAt: -1 })
            .lean();

        let nextNumber = 1;
        if (lastEquipment && lastEquipment.installationreportno) {
            const prevNumStr = lastEquipment.installationreportno.replace("IR4000", "");
            const prevNum = parseInt(prevNumStr, 10);
            if (!isNaN(prevNum)) {
                nextNumber = prevNum + 1;
            }
        }
        const newInstallationReportNo = `IR4000${nextNumber}`;

        // 2) Generate PDFs (Installation Report + Checklist PDFs)
        const attachments = [];

        // 2a) Build & generate the Installation Report PDF
        const dataForInstallationPDF = {
            ...pdfData,
            installationreportno: newInstallationReportNo,
            abnormalCondition,
            voltageData,
        };
        const installationHtml = getCertificateHTML(dataForInstallationPDF);

        let installationBuffer;
        try {
            installationBuffer = await createPdfBuffer(installationHtml, {
                format: "A4",
                orientation: "portrait",
                border: { top: "5mm", right: "5mm", bottom: "5mm", left: "5mm" },
                zoomFactor: 0.5,
                childProcessOptions: { env: { OPENSSL_CONF: "/dev/null" } },
            });
            attachments.push({
                filename: "InstallationReport.pdf",
                content: installationBuffer,
            });
        } catch (err) {
            console.error("Error generating Installation PDF:", err);
            return res.status(500).json({ message: "Failed to create Installation PDF" });
        }

        // 2b) Generate Checklist PDFs for each checklist payload
        for (const cp of checklistPayloads) {
            if (!cp.checklistResults || cp.checklistResults.length === 0) {
                continue;
            }

            // Fetch FormatMaster details using product group from cp
            let formatDetails = { chlNo: "", revNo: "" };
            if (cp.prodGroup) {
                try {
                    const formatDoc = await FormatMaster.findOne({ productGroup: cp.prodGroup });
                    if (formatDoc) {
                        formatDetails.chlNo = formatDoc.chlNo;
                        formatDetails.revNo = formatDoc.revNo;
                    }
                } catch (err) {
                    console.error("Error fetching FormatMaster for product group:", cp.prodGroup, err);
                }
            }

            // Find the matching equipment payload for additional details
            const eqPayload = equipmentPayloads.find(
                (ep) => ep.serialnumber === cp.serialNumber
            );

            // Build data object for checklist HTML generation
            const checklistHtmlData = {
                reportNo: newInstallationReportNo,
                date: pdfData.dateOfInstallation || new Date().toLocaleDateString("en-GB"),
                customer: {
                    hospitalname: pdfData.customerName || "",
                    customercodeid: pdfData.customerId || "",
                    street: pdfData.street || "",
                    city: pdfData.city || "",
                    telephone: pdfData.phoneNumber || "",
                    email: pdfData.email || "", // same email used for customer
                },
                machine: {
                    partNumber: eqPayload ? eqPayload.materialcode : "",
                    modelDescription: eqPayload ? eqPayload.materialdescription : "",
                    serialNumber: cp.serialNumber,
                    machineId: "", // fill if needed
                },
                remarkglobal: cp.globalRemark || "",
                checklistItems: cp.checklistResults,
                serviceEngineer: `${pdfData.userInfo?.firstName || ""} ${pdfData.userInfo?.lastName || ""}`,
                formatChlNo: formatDetails.chlNo,
                formatRevNo: formatDetails.revNo,
            };

            try {
                const checklistHtml = getChecklistHTML(checklistHtmlData);
                const checklistBuffer = await createPdfBuffer(checklistHtml, {
                    format: "A4",
                    orientation: "portrait",
                    border: { top: "5mm", right: "5mm", bottom: "5mm", left: "5mm" },
                    zoomFactor: 0.5,
                    childProcessOptions: { env: { OPENSSL_CONF: "/dev/null" } },
                });

                attachments.push({
                    filename: `Checklist_${cp.serialNumber}.pdf`,
                    content: checklistBuffer,
                });
            } catch (err) {
                console.error(`Error generating checklist PDF for ${cp.serialNumber}:`, err);
                return res.status(500).json({
                    message: `Failed to create checklist PDF for ${cp.serialNumber}`,
                });
            }
        }

        // 3) Insert equipment data into DB.
        const equipmentDocs = equipmentPayloads.map((payload) => ({
            name: payload.name,
            materialdescription: payload.materialdescription,
            serialnumber: payload.serialnumber,
            materialcode: payload.materialcode,
            status: payload.status,
            currentcustomer: payload.currentcustomer,
            custWarrantystartdate: payload.custWarrantystartdate,
            custWarrantyenddate: payload.custWarrantyenddate,
            palnumber: payload.palnumber,
            installationreportno: newInstallationReportNo,
        }));

        let insertedEquipments;
        try {
            insertedEquipments = await Equipment.insertMany(equipmentDocs);
            console.log(
                "Bulk equipment saved with new IRNo=",
                newInstallationReportNo,
                "Count=",
                insertedEquipments.length
            );
        } catch (err) {
            console.error("Error inserting equipment after PDFs generated:", err);
            return res.status(500).json({ message: "Failed to save equipment after PDFs generated" });
        }

        // 4) Insert checklist data into DB.
        let insertedChecklists = [];
        if (checklistPayloads.length > 0) {
            const checklistDocs = checklistPayloads.map((cp) => ({
                serialNumber: cp.serialNumber,
                checklistResults: cp.checklistResults,
                globalRemark: cp.globalRemark || "",
                installationreportno: newInstallationReportNo,
            }));

            try {
                insertedChecklists = await EquipmentChecklist.insertMany(checklistDocs);
                console.log("Checklist data inserted. Count:", insertedChecklists.length);
            } catch (err) {
                console.error("Error inserting checklist data:", err);
                return res.status(500).json({ message: "Failed to save checklist data" });
            }
        }

        // 5) Email Sending

        // 5a) Email to Customer - ONLY Installation Report
        // Using pdfData.email as the customer email.
        const customerEmail = pdfData.email;
        if (!customerEmail) {
            console.error("Customer email is missing in pdfData.email");
            return res.status(400).json({ message: "Customer email is required." });
        }
        const customerMailOptions = {
            from: "webadmin@skanray-access.com",
            to: customerEmail,
            subject: "Your Installation Report",
            text: `Dear Customer,
  
  Please find attached your Installation Report.
  
  Regards,
  Skanray Technologies`,
            attachments: [
                {
                    filename: "InstallationReport.pdf",
                    content: installationBuffer,
                },
            ],
        };

        // 5b) Email to CIC - Installation Report + Checklist PDFs
        const checklistAttachments = attachments.filter(
            (att) => att.filename.startsWith("Checklist_")
        );
        const cicMailOptions = {
            from: "webadmin@skanray-access.com",
            to: "mrshivamtiwari2025@gmail.com",
            subject: "Installation & Checklist Reports for CIC",
            text: `Please find attached the Installation Report and Checklist Report(s).
  
  Regards,
  Skanray Technologies`,
            attachments: [
                {
                    filename: "InstallationReport.pdf",
                    content: installationBuffer,
                },
                ...checklistAttachments,
            ],
        };

        // Send customer email first
        try {
            await transporter.sendMail(customerMailOptions);
            console.log("Customer email sent to:", customerEmail);
        } catch (customerErr) {
            console.error("Error sending customer email:", customerErr);
            return res.status(500).json({ message: "Failed to send customer email", error: customerErr.message });
        }

        // Then send CIC email
        try {
            await transporter.sendMail(cicMailOptions);
            console.log("CIC email sent to: mrshivamtiwari2025@gmail.com");
        } catch (cicErr) {
            console.error("Error sending CIC email:", cicErr);
            return res.status(500).json({ message: "Failed to send CIC email", error: cicErr.message });
        }

        return res.status(201).json({
            message: "Installations saved; Emails sent successfully.",
            insertedEquipments,
            insertedChecklists,
        });
    } catch (err) {
        console.error("Error in bulk creation w/ checklists:", err);
        if (err.code === 11000) {
            return res.status(400).json({ message: "Duplicate Serial or Installation Report No." });
        }
        return res.status(400).json({ message: err.message });
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
