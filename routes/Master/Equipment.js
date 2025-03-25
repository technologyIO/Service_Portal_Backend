const express = require('express');
const router = express.Router();
const Equipment = require('../../Model/MasterSchema/EquipmentSchema');
const PendingInstallation = require('../../Model/UploadSchema/PendingInstallationSchema'); // Adjust the path based on your folder structure
const nodemailer = require('nodemailer');
const pdf = require('html-pdf');
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

// Updated equipment creation endpoint
router.post("/equipment", async (req, res) => {
    try {
        // Extract the equipment and PDF data from request body
        const { equipmentPayload, pdfData } = req.body;

        // LOG the PDF data (including OTP) so you can see exactly what's arriving
        console.log("PDF data received for PDF creation:", pdfData);

        // 1) Create new Equipment in DB
        const equipment = new Equipment({
            name: equipmentPayload.name,
            materialdescription: equipmentPayload.materialdescription,
            serialnumber: equipmentPayload.serialnumber,
            materialcode: equipmentPayload.materialcode,
            status: equipmentPayload.status,
            currentcustomer: equipmentPayload.currentcustomer,
            custWarrantystartdate: equipmentPayload.custWarrantystartdate,
            custWarrantyenddate: equipmentPayload.custWarrantyenddate,
            palnumber: equipmentPayload.palnumber,
        });

        const newEquipment = await equipment.save();
        console.log("Equipment saved:", newEquipment._id);

        // 2) Merge DB fields + PDF-only fields (includes OTP)
        const dataForPDF = {
            // from DB
            name: newEquipment.name,
            serialnumber: newEquipment.serialnumber,
            materialcode: newEquipment.materialcode,
            materialdescription: newEquipment.materialdescription,
            status: newEquipment.status,
            currentcustomer: newEquipment.currentcustomer,
            custWarrantystartdate: newEquipment.custWarrantystartdate,
            custWarrantyenddate: newEquipment.custWarrantyenddate,
            palnumber: newEquipment.palnumber,

            // from pdfData (NOT stored in DB), includes the OTP
            ...pdfData,
        };

        // 3) Generate PDF
        const htmlContent = getCertificateHTML(dataForPDF);
        pdf.create(htmlContent, { 
            format: "A4",
            childProcessOptions: {
                env: {
                    OPENSSL_CONF: '/dev/null',  // This bypasses OpenSSL configuration issues
                },
            },
        }).toBuffer(async (err, buffer) => {
            if (err) {
                console.error("PDF creation error:", err);
                return res.status(500).json({ message: "Failed to create PDF" });
            }

            // 4) Email the PDF to pdfData.email
            const mailOptions = {
                from: "webadmin@skanray-access.com",
                to: pdfData.email || "fallback@example.com",
                subject: "Skanray Installation Report & Warranty Certificate",
                text: "Dear Customer,\n\nPlease find attached your Installation Report & Warranty Certificate.\n\nRegards,\nSkanray Technologies",
                attachments: [
                    {
                        filename: "InstallationReport.pdf",
                        content: buffer,
                    },
                ],
            };

            try {
                await transporter.sendMail(mailOptions);
                console.log("Email sent with PDF attachment.");
                return res.status(201).json(newEquipment);
            } catch (emailErr) {
                console.error("Error sending email with PDF:", emailErr);
                return res.status(500).json({
                    message: "Equipment created, but failed to send email",
                    error: emailErr.message,
                });
            }
        });
    } catch (err) {
        console.error("Error saving equipment:", err);
        if (err.code === 11000) {
            return res.status(400).json({ message: "Serial number already exists." });
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
