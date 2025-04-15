const express = require('express');
const router = express.Router();
const PM = require('../../Model/UploadSchema/PMSchema'); // Adjust path based on your folder structure
const Product = require('../../Model/MasterSchema/ProductSchema');
const CheckList = require('../../Model/CollectionSchema/ChecklistSchema');
const nodemailer = require('nodemailer');
const Customer = require('../../Model/UploadSchema/CustomerSchema');
const pdf = require('html-pdf');
const { getChecklistHTMLPM } = require("./checklistTemplatepm"); // DO NOT change its design

// In-memory store for OTPs keyed by customerCode

const pdfStore = {};
const otpStore = {};
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'webadmin@skanray-access.com',
    pass: 'rdzegwmzirvbjcpm'
  }
});

// Middleware to get a PM by ID
async function getPMById(req, res, next) {
  let pm;
  try {
    pm = await PM.findById(req.params.id);
    if (!pm) {
      return res.status(404).json({ message: 'PM record not found' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
  res.pm = pm;
  next();
}

// Middleware to check for duplicate pmNumber
async function checkDuplicatePMNumber(req, res, next) {
  let pm;
  try {
    pm = await PM.findOne({ pmNumber: req.body.pmNumber });
    if (pm && pm._id.toString() !== req.params.id) {
      return res.status(400).json({ message: 'Duplicate PM number found' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
  next();
}

// GET all PM records with pagination
router.get('/allpms', async (req, res) => {
  try {


    const pms = await PM.find();


    res.json({
      pms,

    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/pms', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const pms = await PM.find().skip(skip).limit(limit);
    const totalPms = await PM.countDocuments();
    const totalPages = Math.ceil(totalPms / limit);

    res.json({
      pms,
      totalPages,
      totalPms
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET PM record by ID
router.get('/pms/:id', getPMById, (req, res) => {
  res.json(res.pm);
});

// CREATE a new PM record
router.post('/pms', checkDuplicatePMNumber, async (req, res) => {
  const pm = new PM({
    pmType: req.body.pmType,
    pmNumber: req.body.pmNumber,
    materialDescription: req.body.materialDescription,
    serialNumber: req.body.serialNumber,
    customerCode: req.body.customerCode,
    region: req.body.region,
    branch: req.body.branch,
    city: req.body.city,
    pmDueMonth: req.body.pmDueMonth,
    pmDoneDate: req.body.pmDoneDate,
    pmVendorCode: req.body.pmVendorCode,
    pmEngineerCode: req.body.pmEngineerCode,
    pmStatus: req.body.pmStatus
  });
  try {
    const newPM = await pm.save();
    res.status(201).json(newPM);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// UPDATE a PM record
router.put('/pms/:id', getPMById, async (req, res) => {
  const updates = [
    'pmType',
    'pmNumber',
    'materialDescription',
    'serialNumber',
    'customerCode',
    'region',
    'branch',
    'city',
    'pmDueMonth',
    'pmDoneDate',
    'pmVendorCode',
    'pmEngineerCode',
    'pmStatus',
    'partNumber' // Added partNumber to the update list
  ];

  updates.forEach(field => {
    if (req.body[field] != null) {
      res.pm[field] = req.body[field];
    }
  });

  try {
    const updatedPM = await res.pm.save();
    res.json(updatedPM);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


// DELETE a PM record
router.delete('/pms/:id', getPMById, async (req, res) => {
  try {
    const deletedPM = await PM.deleteOne({ _id: req.params.id });
    if (deletedPM.deletedCount === 0) {
      return res.status(404).json({ message: 'PM record not found' });
    }
    res.json({ message: 'Deleted PM record' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// SEARCH PM records
router.get('/pmsearch', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ message: 'Query parameter is required' });
    }

    const query = {
      $or: [
        { pmType: { $regex: q, $options: 'i' } },
        { pmNumber: { $regex: q, $options: 'i' } },
        { materialDescription: { $regex: q, $options: 'i' } },
        { serialNumber: { $regex: q, $options: 'i' } },
        { customerCode: { $regex: q, $options: 'i' } },
        { region: { $regex: q, $options: 'i' } },
        { branch: { $regex: q, $options: 'i' } },
        { city: { $regex: q, $options: 'i' } },
        { pmVendorCode: { $regex: q, $options: 'i' } },
        { pmEngineerCode: { $regex: q, $options: 'i' } },
        { pmStatus: { $regex: q, $options: 'i' } }
      ]
    };

    const pms = await PM.find(query);
    res.json(pms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



router.get('/checklist/by-part/:partnoid', async (req, res) => {
  try {
    const partnoid = req.params.partnoid;

    // Find the product using the provided partnoid
    const product = await Product.findOne({ partnoid });
    if (!product) {
      return res.status(404).json({ message: 'Product not found for the provided part number' });
    }

    // Get the product group from the found product
    const productGroup = product.productgroup;

    // Find checklists where prodGroup matches the product group
    const checklists = await CheckList.find({ prodGroup: productGroup })
      .select('checklisttype checkpointtype checkpoint prodGroup result status createdAt modifiedAt resulttype');

    res.json({
      productGroup,
      checklists
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/otp/send", async (req, res) => {
  try {
    const { customerCode } = req.body;
    if (!customerCode) {
      return res.status(400).json({ message: "Customer code is required" });
    }
    const customer = await Customer.findOne({ customercodeid: customerCode });
    if (!customer) {
      return res.status(404).json({
        message: "Customer not found for the given customer code"
      });
    }
    const email = customer.email;
    if (!email) {
      return res
        .status(404)
        .json({ message: "No email found for this customer" });
    }
    // 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Store in memory or DB
    global.otpStore = global.otpStore || {}; 
    global.otpStore[customerCode] = { otp, timestamp: Date.now() };
    // Send via nodemailer
    await transporter.sendMail({
      from: "webadmin@skanray-access.com",
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is ${otp}`
    });
    res.json({ message: "OTP sent successfully to " + email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/otp/verify", async (req, res) => {
  try {
    const { customerCode, otp } = req.body;
    if (!customerCode || !otp) {
      return res
        .status(400)
        .json({ message: "Customer code and OTP are required" });
    }
    global.otpStore = global.otpStore || {};
    const record = global.otpStore[customerCode];
    if (!record) {
      return res
        .status(400)
        .json({ message: "OTP not requested for this customer" });
    }
    if (record.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    // Remove from store
    delete global.otpStore[customerCode];
    // Double-check the customer
    const customer = await Customer.findOne({ customercodeid: customerCode });
    if (!customer || !customer.email) {
      return res
        .status(404)
        .json({ message: "Customer or customer email not found" });
    }
    res.json({ message: "OTP verified successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================
// (B) ONE-BY-ONE PM Processing Route
// ==========================
//
// You call this from the frontend for each PM after OTP is verified.
// This route does two things:
//   1) Updates the PM record in Mongo with new partNumber, doneDate, etc.
//   2) Generates a PDF with your custom design (embedding the PM & checklist data).
//   3) Stores the PDF buffer into pdfStore[customerCode] so that we can later
//      attach them all in the final email route.
//
router.post("/reportAndUpdate", async (req, res) => {
  try {
    const { pmData, checklistData, customerCode, globalRemark } = req.body;

    if (!pmData || !customerCode) {
      return res
        .status(400)
        .json({ message: "PM data and customer code are required" });
    }

    const existingPm = await PM.findById(pmData._id);
    if (!existingPm) {
      return res.status(404).json({ message: "PM record not found" });
    }

    // ✅ Generate and assign new pmNumber if not present
    if (!existingPm.pmNumber) {
      const lastPmWithNumber = await PM.find({ pmNumber: { $exists: true } })
        .sort({ createdAt: -1 })
        .limit(1);

      let nextNumber = 1;
      if (lastPmWithNumber.length > 0) {
        const lastNumber = parseInt(
          lastPmWithNumber[0].pmNumber.replace("PM", ""),
          10
        );
        nextNumber = lastNumber + 1;
      }

      const newPmNumber = "PM" + nextNumber.toString().padStart(5, "0");
      existingPm.pmNumber = newPmNumber;
    }

    // ✅ Only update necessary fields (do NOT update partNumber)
    existingPm.pmDoneDate = pmData.pmDoneDate;
    existingPm.pmEngineerCode = pmData.pmEngineerCode;
    existingPm.pmStatus = pmData.pmStatus;

    await existingPm.save();

    // ✅ Fetch customer data
    const customer = await Customer.findOne({ customercodeid: customerCode });
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // ✅ Prepare checklist HTML
    const checklistHtml = getChecklistHTMLPM({
      reportNo: existingPm.pmNumber,
      date: existingPm.pmDoneDate,
      pmType: existingPm.pmType,
      city: existingPm.city,
      customer,
      machine: {
        partNumber: existingPm.partNumber,
        modelDescription: existingPm.materialDescription,
        serialNumber: existingPm.serialNumber,
        machineId: existingPm._id,
      },
      // NOTE: Match the actual fields from your front-end data:
      checklistItems: (checklistData || []).map((c) => ({
        checkpoint: c.checkpoint,         // previously was c.checklistId
        result: c.result || "",           // previously was c.answer
        remark: c.remark || "",           // previously was c.comment
      })),
      serviceEngineer: existingPm.pmEngineerCode,
      remarkglobal: globalRemark || "N/A",
      formatChlNo: "3-75-028-0036-85",
      formatRevNo: "0",
    });

    // ✅ Generate PDF from HTML
    const pdfOptions = {
      format: "A4",
      childProcessOptions: { env: { OPENSSL_CONF: "/dev/null" } },
    };

    pdf.create(checklistHtml, pdfOptions).toBuffer((err, pdfBuffer) => {
      if (err) {
        console.error("Error generating Checklist PDF:", err);
        return res
          .status(500)
          .json({ message: "Failed to create Checklist PDF" });
      }

      // ✅ Store in pdfStore
      if (!pdfStore[customerCode]) {
        pdfStore[customerCode] = [];
      }

      pdfStore[customerCode].push({
        filename: `Checklist_${existingPm.pmNumber}.pdf`,
        buffer: pdfBuffer,
      });

      // ✅ Send response for this file
      res.json({ message: "PM updated & PDF generated successfully" });
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: err.message });
  }
});



// ==========================
// (C) Final Email Route
// ==========================
//
// After all PMs are processed in the frontend loop, call this route to
// send all PDFs for this customer as separate attachments in one email.
//
router.post("/sendAllPdfs", async (req, res) => {
  try {
    const { customerCode } = req.body;
    if (!customerCode) {
      return res
        .status(400)
        .json({ message: "Customer code is required to send PDFs" });
    }
    const customer = await Customer.findOne({ customercodeid: customerCode });
    if (!customer || !customer.email) {
      return res
        .status(404)
        .json({ message: "Customer or customer email not found" });
    }
    if (!pdfStore[customerCode] || pdfStore[customerCode].length === 0) {
      return res
        .status(400)
        .json({ message: "No PDFs available for this customer" });
    }
    const attachments = pdfStore[customerCode].map((f) => ({
      filename: f.filename,
      content: f.buffer,
      contentType: "application/pdf"
    }));

    const mailOptions = {
      from: "webadmin@skanray-access.com",
      to: customer.email,
      subject: "Skanray - Your Checklist PDFs",
      text: "Please find attached the completed checklist PDFs for your PMs.",
      attachments
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending final email:", error);
        return res
          .status(500)
          .json({ message: "Failed to send final email" });
      }
      // Clear the pdfStore for this customer, so we don’t re-send the same PDFs
      delete pdfStore[customerCode];
      return res.json({
        message: "All PDF attachments sent successfully"
      });
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
