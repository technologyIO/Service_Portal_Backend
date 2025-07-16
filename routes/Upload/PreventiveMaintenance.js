const express = require('express');
const router = express.Router();
const PM = require('../../Model/UploadSchema/PMSchema'); // Adjust path based on your folder structure
const Product = require('../../Model/MasterSchema/ProductSchema');
const User = require('../../Model/MasterSchema/UserSchema');
const CheckList = require('../../Model/CollectionSchema/ChecklistSchema');
const Branch = require('../../Model/CollectionSchema/BranchSchema');
const State = require('../../Model/CollectionSchema/StateSchema');
const nodemailer = require('nodemailer');
const Customer = require('../../Model/UploadSchema/CustomerSchema');
const PMDocMaster = require('../../Model/MasterSchema/pmDocMasterSchema');
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




router.get('/allpms/:employeeid?', async (req, res) => {
  try {
    const { employeeid } = req.params;

    if (employeeid) {
      const user = await User.findOne({ employeeid });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get user's branch codes
      const branchDemographic = user.demographics.find(d => d.type === 'branch');
      let userBranchShortCodes = [];

      if (branchDemographic) {
        if (branchDemographic.values.some(v => v.branchShortCode)) {
          userBranchShortCodes = branchDemographic.values
            .map(v => v.branchShortCode)
            .filter(Boolean);
        }
        else if (branchDemographic.values.some(v => v.id)) {
          const branchIds = branchDemographic.values
            .map(v => v.id)
            .filter(Boolean);

          const branches = await Branch.find({ _id: { $in: branchIds } })
            .select('branchShortCode -_id');

          userBranchShortCodes = branches.map(b => b.branchShortCode);
        }
        else if (branchDemographic.values.some(v => v.name)) {
          const branchNames = branchDemographic.values
            .map(v => v.name)
            .filter(Boolean);

          const branches = await Branch.find({ name: { $in: branchNames } })
            .select('branchShortCode -_id');

          userBranchShortCodes = branches.map(b => b.branchShortCode);
        }
      }

      if (userBranchShortCodes.length === 0) {
        return res.json({ pms: [], count: 0, filteredByEmployee: true });
      }

      // Get user's part numbers
      const partNumbers = user.skills.flatMap(skill =>
        skill.partNumbers || []
      ).filter(pn => pn);

      if (partNumbers.length === 0) {
        return res.json({ pms: [], count: 0, filteredByEmployee: true });
      }

      // Modified PM query to only include Due or Overdue status
      const pms = await PM.find({
        partNumber: { $in: partNumbers },
        pmStatus: { $in: ["Due", "Overdue"] } // Only these statuses
      });

      if (pms.length === 0) {
        return res.json({ pms: [], count: 0, filteredByEmployee: true });
      }

      // Rest of the processing
      const customerCodes = [...new Set(pms.map(pm => pm.customerCode).filter(Boolean))];
      const customers = await Customer.find({ customercodeid: { $in: customerCodes } });
      const customerRegions = [...new Set(customers.map(c => c.region).filter(Boolean))];
      const states = await State.find({ stateId: { $in: customerRegions } });
      const stateNames = states.map(s => s.name);
      const branches = await Branch.find({ state: { $in: stateNames } });

      // Filter branches by user's branch codes
      const allowedBranches = branches.filter(b =>
        userBranchShortCodes.includes(b.branchShortCode)
      );

      // Final PM filtering
      const finalPMs = pms.filter(pm => {
        const customer = customers.find(c => c.customercodeid === pm.customerCode);
        if (!customer) return false;

        const state = states.find(s => s.stateId === customer.region);
        if (!state) return false;

        return allowedBranches.some(b => b.state === state.name);
      });

      return res.json({
        pms: finalPMs,
        count: finalPMs.length,
        filteredByEmployee: true
      });
    }

    // If no employeeid provided, return all PMs with Due/Overdue status
    const allPMs = await PM.find({
      pmStatus: { $in: ["Due", "Overdue"] } // Only these statuses
    });

    return res.json({
      pms: allPMs,
      count: allPMs.length,
      filteredByEmployee: false
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});
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
router.get('/pmdoc/by-part/:partnoid', async (req, res) => {
  try {
    const partnoid = req.params.partnoid;

    // Step 1: Find the product using partnoid
    const product = await Product.findOne({ partnoid });
    if (!product) {
      return res.status(404).json({ message: 'Product not found for the provided part number' });
    }

    // Step 2: Extract product group
    const productGroup = product.productgroup;

    // Step 3: Find PM Doc Master entries matching product group and type "PM"
    const pmDocs = await PMDocMaster.find({
      productGroup: productGroup,
      type: 'PM'
    }).select('chlNo revNo type status createdAt modifiedAt');

    res.json({
      productGroup,
      pmDocs
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
    const { pmData, checklistData, customerCode, globalRemark, userInfo } = req.body;

    if (!pmData || !customerCode) {
      return res.status(400).json({ message: "PM data and customer code are required" });
    }

    const existingPm = await PM.findById(pmData._id);
    if (!existingPm) {
      return res.status(404).json({ message: "PM record not found" });
    }

    // Generate and assign new pmNumber if not present
    if (!existingPm.pmNumber) {
      try {
        // Find all existing PM numbers sorted numerically
        const allPMs = await PM.find({ pmNumber: { $regex: /^PM\d+$/ } })
          .sort({ pmNumber: 1 });

        let nextNumber = 1; // Default starting number

        if (allPMs.length > 0) {
          // Extract all existing numbers
          const existingNumbers = allPMs.map(pm => {
            const numStr = pm.pmNumber.replace('PM', '');
            return parseInt(numStr, 10);
          }).filter(num => !isNaN(num));

          // Find the first gap in numbering or the next number
          for (let i = 0; i < existingNumbers.length; i++) {
            if (existingNumbers[i] !== i + 1) {
              nextNumber = i + 1;
              break;
            }
          }

          // If no gaps found, use next number after highest
          if (nextNumber === 1 && existingNumbers.length > 0) {
            nextNumber = Math.max(...existingNumbers) + 1;
          }
        }

        // Format with leading zeros (minimum 4 digits, but can be more)
        const newPmNumber = "PM" + nextNumber.toString().padStart(4, "0");

        // Final check for uniqueness
        const exists = await PM.findOne({ pmNumber: newPmNumber });
        if (exists) {
          // If by some chance it exists, find next available
          let tempNumber = nextNumber + 1;
          while (true) {
            const tempPmNumber = "PM" + tempNumber.toString().padStart(4, "0");
            const tempExists = await PM.findOne({ pmNumber: tempPmNumber });
            if (!tempExists) {
              existingPm.pmNumber = tempPmNumber;
              break;
            }
            tempNumber++;
          }
        } else {
          existingPm.pmNumber = newPmNumber;
        }
      } catch (err) {
        console.error("Error generating PM number:", err);
        // Fallback to timestamp-based number if something goes wrong
        const timestamp = Date.now();
        existingPm.pmNumber = "PM" + timestamp.toString().slice(-6); // Use last 6 digits
      }
    }

    // Update necessary fields
    existingPm.pmDoneDate = pmData.pmDoneDate || existingPm.pmDoneDate;
    existingPm.pmEngineerCode = userInfo.employeeId || existingPm.pmEngineerCode;
    existingPm.pmStatus = pmData.pmStatus || existingPm.pmStatus;

    await existingPm.save();

    // Fetch customer data
    const customer = await Customer.findOne({ customercodeid: customerCode });
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Prepare checklist HTML
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
      checklistItems: (checklistData || []).map((c) => ({
        checkpoint: c.checkpoint,
        result: c.result || "",
        remark: c.remark || "",
      })),
      serviceEngineer: existingPm.pmEngineerCode,
      remarkglobal: globalRemark || "N/A",
      formatChlNo: pmData.chlNo,
      formatRevNo: pmData.revNo,
    });

    // Generate PDF from HTML
    const pdfOptions = {
      format: "A4",
      childProcessOptions: { env: { OPENSSL_CONF: "/dev/null" } },
    };

    pdf.create(checklistHtml, pdfOptions).toBuffer((err, pdfBuffer) => {
      if (err) {
        console.error("Error generating Checklist PDF:", err);
        return res.status(500).json({ message: "Failed to create Checklist PDF" });
      }

      // Store in pdfStore
      if (!pdfStore[customerCode]) {
        pdfStore[customerCode] = [];
      }

      pdfStore[customerCode].push({
        filename: `Checklist_${existingPm.pmNumber}.pdf`,
        buffer: pdfBuffer,
      });

      res.json({
        message: "PM updated & PDF generated successfully",
        pmNumber: existingPm.pmNumber
      });
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
    const {
      customerCode,
      email,            // Service engineer email
      manageremail,     // Array of manager emails
      dealerEmail       // Optional dealer email
    } = req.body;

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

    // Build recipient list:
    const recipients = [customer.email]; // always send to customer
    if (email) recipients.push(email); // service engineer
    if (Array.isArray(manageremail)) recipients.push(...manageremail); // all managers
    if (dealerEmail) recipients.push(dealerEmail); // optional dealer

    const mailOptions = {
      from: "webadmin@skanray-access.com",
      to: recipients, // will include all valid emails
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
      delete pdfStore[customerCode]; // Clear the stored PDFs
      return res.json({ message: "All PDF attachments sent successfully" });
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
