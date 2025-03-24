const express = require('express');
const router = express.Router();
const PM = require('../../Model/UploadSchema/PMSchema'); // Adjust path based on your folder structure
const Product = require('../../Model/MasterSchema/ProductSchema');
const CheckList = require('../../Model/CollectionSchema/ChecklistSchema');
const nodemailer = require('nodemailer');
const Customer = require('../../Model/UploadSchema/CustomerSchema');
const puppeteer = require('puppeteer'); // For PDF generation

// In-memory store for OTPs keyed by customerCode


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
        regionBranch: req.body.regionBranch,
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
router.put('/pms/:id', getPMById, checkDuplicatePMNumber, async (req, res) => {
    const updates = [
        'pmType',
        'pmNumber',
        'materialDescription',
        'serialNumber',
        'customerCode',
        'regionBranch',
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
                { regionBranch: { $regex: q, $options: 'i' } },
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

router.post('/otp/send', async (req, res) => {
    try {
        const { customerCode } = req.body;
        if (!customerCode) {
            return res.status(400).json({ message: 'Customer code is required' });
        }

        // 1) Find the customer in the DB by customercodeid
        const customer = await Customer.findOne({ customercodeid: customerCode });
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found for the given customer code' });
        }

        // 2) Get the email from the customer document
        const email = customer.email;
        if (!email) {
            return res.status(404).json({ message: 'No email found for this customer' });
        }

        // 3) Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 4) Store the OTP with timestamp in memory (you can also store it in your DB if you want persistence)
        otpStore[customerCode] = {
            otp,
            timestamp: Date.now()
        };

        // 5) Prepare email options
        let mailOptions = {
            from: 'webadmin@skanray-access.com',
            to: email,
            subject: 'Your OTP Code',
            text: `Your OTP code is ${otp}`
        };

        // 6) Send the email using nodemailer
        await transporter.sendMail(mailOptions);

        return res.json({ message: 'OTP sent successfully to ' + email });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

router.post('/otp/verify', async (req, res) => {
    try {
        // Expect pmData (PM details) and checklistData in the payload
        const { customerCode, otp, pmData, checklistData } = req.body;
        if (!customerCode || !otp) {
            return res.status(400).json({ message: 'Customer code and OTP are required' });
        }

        // Check if we have an OTP in memory for this customer code
        const record = otpStore[customerCode];
        if (!record) {
            return res.status(400).json({ message: 'OTP not requested for this customer' });
        }

        // Compare the OTP
        if (record.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // OTP verified; remove it from the store.
        delete otpStore[customerCode];

        // Fetch full customer details using customerCode from the Customer schema
        const customer = await Customer.findOne({ customercodeid: customerCode });
        if (!customer || !customer.email) {
            return res.status(404).json({ message: 'Customer or customer email not found' });
        }

        // Build Service Report HTML Template
        const serviceReportHtml = `
          <!DOCTYPE html>
          <html>
             <head>
               <meta charset="UTF-8" />
               <title>Skanray Service Report</title>
               <style>
                  body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
                  .report-container { width: 210mm; margin: 0 auto; border: 1.5px solid red; padding: 15px; box-sizing: border-box; }
                  table { width: 100%; border: 1px solid black; border-collapse: collapse; font-size: 14px; }
                  td, th { border: 1px solid black; padding: 6px; vertical-align: top; }
                  .report-title { font-size: 16px; font-weight: bold; text-align: center; }
                  .label-cell { width: 40%; font-weight: bold; }
                  .value-cell { width: 60%; }
               </style>
             </head>
             <body>
               <div id="pdf-content" class="report-container">
                  <table>
                     <tr>
                       <td style="width: 15%; text-align: center">
                          <img src="https://skanray.com/wp-content/uploads/2024/07/Skanray-logo.png" alt="Skanray Logo" style="width: 80px; height: auto" />
                       </td>
                       <td style="width: 45%; text-align: center">
                          <div class="report-title">
                             Skanray Technologies Limited<br />Service Report
                          </div>
                       </td>
                       <td style="width: 40%; padding: 0; vertical-align: top">
                          <table style="width: 100%; border-collapse: collapse">
                             <tr>
                                <td class="label-cell">Format No:</td>
                                <td class="value-cell">3F/2014</td>
                             </tr>
                             <tr>
                                <td class="label-cell">Number:</td>
                                <td class="value-cell"></td>
                             </tr>
                             <tr>
                                <td class="label-cell">Revision:</td>
                                <td class="value-cell">0</td>
                             </tr>
                          </table>
                       </td>
                     </tr>
                  </table>
                  <table>
                     <tr>
                       <td style="width: 40%">
                          <strong>PM No:</strong><br />
                          <div>${(pmData && pmData.pmNumber) || ''}</div>
                       </td>
                       <td style="width: 20%">
                          <strong>Date:</strong><br />
                          <div>${new Date().toLocaleDateString()}</div>
                       </td>
                       <td style="width: 40%">
                          <strong>Service Type:</strong><br />
                          <div>${(pmData && pmData.serviceType) || ''}</div>
                       </td>
                     </tr>
                     <tr>
                       <td rowspan="3">
                          <strong>Customer Code:</strong><br />
                          <div>${customer.customercodeid || ''}</div>
                          <strong>Name:</strong><br />
                          <div>${customer.hospitalname || ''}</div>
                          <strong>Address:</strong><br />
                          <div>${customer.street || ''}, ${customer.city || ''}, ${customer.postalcode || ''}</div>
                          <strong>Telephone:</strong><br />
                          <div>${customer.telephone || ''}</div>
                          <strong>Email:</strong><br />
                          <div>${customer.email || ''}</div>
                       </td>
                       <td style="width: 20%">
                          <strong>Part Number:</strong><br />
                          <div>${(pmData && pmData.partNumber) || ''}</div>
                       </td>
                       <td style="width: 40%">
                          <div></div>
                       </td>
                     </tr>
                     <tr>
                       <td>
                          <strong>Description:</strong><br />
                          <div>${(pmData && pmData.description) || ''}</div>
                       </td>
                       <td>
                          <div></div>
                       </td>
                     </tr>
                     <tr>
                       <td>
                          <strong>Serial Number:</strong><br />
                          <div>${(pmData && pmData.serialNumber) || ''}</div>
                       </td>
                       <td>
                          <div></div>
                       </td>
                     </tr>
                  </table>
                    <table>
          <!-- पहली पंक्ति: Date Attended (बाएँ) और Problem Reported (दाएँ) -->
          <tr>
            <!-- colspan="2" ताकि बाएँ वाला सेल दो कॉलम कवर करे (कुल 4 कॉलम की टेबल में) -->
            <td colspan="2" style="width: 50%">
              <strong>Date Attended:</strong>
              <div class="placeholder"></div>
            </td>
            <!-- दाईं ओर भी colspan="2" -->
            <td colspan="2" style="width: 50%">
              <strong>Problem Reported:</strong>
              <div class="placeholder"></div>
            </td>
          </tr>

          <!-- दूसरी पंक्ति: Problem Observed & Action Taken… (पूरी चौड़ाई में) -->
          <tr>
            <!-- colspan="4" का उपयोग, क्योंकि हम चार कॉलम की टेबल में यह सेल पूरा फैलाना चाहते हैं -->
            <td colspan="4">
              <strong
                >Problem Observed &amp; Action Taken by Service
                Engineer/Technician:</strong
              >
              <div class="placeholder" style="height: 80px"></div>
            </td>
          </tr>

          <!-- तीसरी पंक्ति: Any abnormal site conditions… (पूरी चौड़ाई में) -->
          <tr>
            <td colspan="4">
              <strong>Any abnormal site conditions:</strong>
              <div class="placeholder"></div>
            </td>
          </tr>

          <!-- चौथी पंक्ति: Supply Voltage(V), L-N/R-Y, L-G/Y-B, N-G/B-R (चार कॉलम) -->
          <tr>
            <td style="width: 25%">
              <strong>Supply Voltage(V)</strong>
            </td>
            <td style="width: 25%">
              <strong>L-N/R-Y</strong>
            </td>
            <td style="width: 25%">
              <strong>L-G/Y-B</strong>
            </td>
            <td style="width: 25%">
              <strong>N-G/B-R</strong>
            </td>
          </tr>
        </table>
          <h3>Injury Details (if applicable)</h3>

        <table>
          <!-- पहली पंक्ति: विभिन्न प्रकार के प्रभावित व्यक्ति और चेकबॉक्स -->
          <tr>
            <td colspan="5">
              <strong>Affected Person:</strong>
              <span class="checkbox-group">
                <label
                  ><input
                    type="checkbox"
                    name="affected_operator"
                  />Operator</label
                >
                <label
                  ><input
                    type="checkbox"
                    name="affected_patient"
                  />Patient</label
                >
                <label
                  ><input type="checkbox" name="affected_engineer" />Service
                  Engineer</label
                >
                <label
                  ><input type="checkbox" name="affected_others" />Others</label
                >
              </span>
            </td>
          </tr>

          <!-- दूसरी पंक्ति: पहचान, आयु और जेंडर -->
          <tr>
            <!-- कॉलम 1: प्रभावित व्यक्ति की पहचान -->
            <td style="width: 30%">
              <strong>Affected person identification:</strong><br />
              <div
                type="text"
                name="person_identification"
                style="width: 90%"
              />
            </td>

            <!-- कॉलम 2: आयु -->
            <td style="width: 20%">
              <strong>Age:</strong><br />
              <div type="text" name="person_age" style="width: 90%" />
            </td>

            <!-- कॉलम 3 एवं 4 मिलाकर (colspan="3") जेंडर विवरण -->
            <td colspan="3">
              <strong>Gender of Affected Person:</strong><br />
              <label><input type="checkbox" name="gender_male" />Male</label>
              <label
                ><input type="checkbox" name="gender_female" />Female</label
              >
            </td>
          </tr>

          <!-- तीसरी पंक्ति: इंजरी विवरण / अन्य सुरक्षा मुद्दों के लिए टेक्स्ट एरिया -->
          <tr>
            <td colspan="5">
              <strong>Describe injury/Treatment or other safety issues:</strong
              ><br />
              <div
                name="injury_description"
                style="width: 100%; height: 80px"
              ></div>
            </td>
          </tr>
        </table>
        <table>
          <!-- शीर्ष का बड़ा सेल -->
          <tr>
            <td colspan="4">
              <strong
                >Details of Parts/Modules/Sub-assemblies replaced (Write NA if
                serial number is not available)</strong
              >
            </td>
          </tr>
          <!-- हेडर रो -->
          <tr style="">
            <th style="width: 10%; border: 1px solid black">SL.No</th>
            <th style="width: 40%; border: 1px solid black">
              Part Description
            </th>
            <th style="width: 25%; border: 1px solid black">
              Defective part serial number
            </th>
            <th style="width: 25%; border: 1px solid black">
              Replaced part Serial number
            </th>
          </tr>
          <!-- पाँच पंक्तियाँ 1 से 5 तक -->
          <tr>
            <td>1</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>2</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>3</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>4</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        </table>
         <table>
          <!-- पहली पंक्ति: Payments से सम्बन्धित निर्देश -->
          <tr>
            <td style="font-size: 12px; font-weight: bold">
              Payments to be made through Cheque / DD in-favour of Skanray
              Technologies Limited. only
            </td>
          </tr>

          <!-- दूसरी पंक्ति: Terms for on-call service -->
          <tr>
            <td style="font-size: 10px; font-weight: bold">
              <span class="section-heading">TERMS FOR ON-CALL SERVICE</span
              ><br />
              Payment: Full Payment as per the rate schedule available with the
              engineer should be made in advance.<br />
              Agreement: The foregoing terms &amp; conditions shall prevail
              notwithstanding any variations contained in any document received
              from any customer unless such variations have been specifically
              agreed upon in writing by Skanray Technologies Limited
            </td>
          </tr>

          <!-- तीसरी पंक्ति: Customer Interaction Center -->
          <tr>
            <td style="font-size: 12px; font-weight: bold">
              Customer Interaction Center (CIC) Toll Free No.: 1800-425-7002
              &nbsp;&nbsp; Email: cic@skanray.com
            </td>
          </tr>
        </table>
               </div>
             </body>
          </html>
       `;

        // Build Installation Checklist HTML Template
        // First, build dynamic checklist rows
        const checklistRows = (checklistData && checklistData.length) ?
            checklistData.map((item, index) => `
             <tr>
                <td style="width: 10%; border: 1px solid black">${index + 1}</td>
                <td style="width: 40%; border: 1px solid black">${item.description || ''}</td>
                <td style="width: 25%; border: 1px solid black">${item.result || ''}</td>
                <td style="width: 25%; border: 1px solid black">${item.remarks || ''}</td>
             </tr>
          `).join('') :
            `<tr>
             <td colspan="4" style="text-align: center; border: 1px solid black;">No checklist data available</td>
          </tr>`;

        const checklistHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
              <title>Skanray Installation Checklist</title>
              <style>
                 body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
                 .report-container { width: 210mm; margin: 0 auto; border: 1.5px solid red; padding: 15px; box-sizing: border-box; }
                 table { width: 100%; border: 1px solid black; border-collapse: collapse; font-size: 14px; }
                 td, th { border: 1px solid black; padding: 6px; vertical-align: top; }
                 .report-title { font-size: 16px; font-weight: bold; text-align: center; }
                 .label-cell { width: 40%; font-weight: bold; }
                 .value-cell { width: 60%; }
              </style>
            </head>
            <body>
              <div id="pdf-content" class="report-container">
                <table>
                  <tr>
                    <td style="width: 15%; text-align: center">
                      <img src="https://skanray.com/wp-content/uploads/2024/07/Skanray-logo.png" alt="Skanray Logo" style="width: 80px; height: auto" />
                    </td>
                    <td style="width: 45%; text-align: center">
                      <div class="report-title">
                        Skanray Technologies Limited<br />Installation Checklist
                      </div>
                    </td>
                    <td style="width: 40%; padding: 0">
                      <table style="width: 100%">
                        <tr>
                          <td class="label-cell">Format No & Revision:</td>
                          <td class="value-cell"></td>
                        </tr>
                        <tr>
                          <td class="label-cell">Document reference no & Revision :-</td>
                          <td class="value-cell"></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <table>
                  <tr>
                    <td style="width: 40%">
                      <strong>Report No:</strong><br />
                      <div>${(pmData && pmData.reportNo) || ''}</div>
                    </td>
                    <td style="width: 20%">
                      <strong>Date:</strong><br />
                      <div>${new Date().toLocaleDateString()}</div>
                    </td>
                  </tr>
                  <tr>
                    <td rowspan="3">
                      <strong>Customer Code:</strong><br />
                      <div>${customer.customercodeid || ''}</div>
                      <strong>Name:</strong><br />
                      <div>${customer.hospitalname || ''}</div>
                      <strong>Address:</strong><br />
                      <div>${customer.street || ''}, ${customer.city || ''}</div>
                      <strong>City:</strong><br />
                      <div>${customer.city || ''}</div>
                      <strong>Telephone:</strong><br />
                      <div>${customer.telephone || ''}</div>
                      <strong>Email:</strong><br />
                      <div>${customer.email || ''}</div>
                    </td>
                    <td style="width: 20%">
                      <strong>Part Number:</strong><br />
                      <div>${(pmData && pmData.partNumber) || ''}</div>
                    </td>
                    <td style="width: 40%">
                      <div></div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Description:</strong><br />
                      <div>${(pmData && pmData.description) || ''}</div>
                    </td>
                    <td>
                      <div></div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Serial Number:</strong><br />
                      <div>${(pmData && pmData.serialNumber) || ''}</div>
                    </td>
                    <td>
                      <div></div>
                    </td>
                  </tr>
                </table>
                 <table>
          <!-- शीर्ष का बड़ा सेल -->

          <!-- हेडर रो -->
          <tr style="">
            <th style="width: 10%; border: 1px solid black">SL.No</th>
            <th style="width: 40%; border: 1px solid black">Descriptions</th>
            <th style="width: 25%; border: 1px solid black">Result</th>
            <th style="width: 25%; border: 1px solid black">Remarks</th>
          </tr>
          <!-- पाँच पंक्तियाँ 1 से 5 तक -->
          <tr>
            <td>1</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>2</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>3</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>4</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td>5</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        </table>
               
                
                <table>
          <tr>
            <th style="width: 15%">Remarks</th>
            <td class="remarks-cell" colspan="2">
              (Common Remarks Char: 600)<br /><br />
              <!-- उपयोगकर्ता आवश्यकतानुसार 600 वर्ण तक विवरण भर सकते हैं -->
            </td>
          </tr>
          <tr>
            <th style="width: 15%">Service Engineer Name</th>
            <td style="width: 35%">
              <!-- यहाँ इंजीनियर का नाम भरें -->
            </td>
            <td class="signature-cell" style="width: 50%">
              <b>Skanray Digital Signature</b>
              <!-- डिजिटल सिग्नेचर या हस्ताक्षर -->
            </td>
          </tr>
        </table>
              </div>
            </body>
          </html>
       `;

        // Use Puppeteer to generate PDFs for both templates
        const browser = await puppeteer.launch();

        // Generate Service Report PDF
        const reportPage = await browser.newPage();
        await reportPage.setContent(serviceReportHtml, { waitUntil: 'networkidle0' });
        const serviceReportPdfBuffer = await reportPage.pdf({ format: 'A4' });

        // Generate Installation Checklist PDF
        const checklistPage = await browser.newPage();
        await checklistPage.setContent(checklistHtml, { waitUntil: 'networkidle0' });
        const checklistPdfBuffer = await checklistPage.pdf({ format: 'A4' });

        await browser.close();

        // Define email recipients
        const cicEmail = 'mrshivamtiwari2025@gmail.com'; // CIC receives both PDFs
        const customerEmail = customer.email;              // Customer receives only the Service Report

        // Email to CIC with both attachments
        let mailOptionsCIC = {
            from: 'webadmin@skanray-access.com',
            to: cicEmail,
            subject: 'Installation Checklist and Service Report',
            text: 'Please find attached the installation checklist and service report.',
            attachments: [
                {
                    filename: 'ServiceReport.pdf',
                    content: serviceReportPdfBuffer,
                    contentType: 'application/pdf'
                },
                {
                    filename: 'InstallationChecklist.pdf',
                    content: checklistPdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        // Email to Customer with only the Service Report attachment
        let mailOptionsCustomer = {
            from: 'webadmin@skanray-access.com',
            to: customerEmail,
            subject: 'Service Report',
            text: 'Please find attached the service report.',
            attachments: [
                {
                    filename: 'ServiceReport.pdf',
                    content: serviceReportPdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        await transporter.sendMail(mailOptionsCIC);
        await transporter.sendMail(mailOptionsCustomer);

        return res.json({ message: 'Report and checklist generated and emailed successfully' });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});




module.exports = router;
