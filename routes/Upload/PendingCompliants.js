const express = require('express');
const router = express.Router();
const PendingComplaints = require('../../Model/UploadSchema/PendingCompliantsSchema');
const nodemailer = require('nodemailer');
const Equipment = require('../../Model/MasterSchema/EquipmentSchema');
const Customer = require('../../Model/UploadSchema/CustomerSchema'); // Adjust the path as necessary
const pdf = require("html-pdf");
let otpStore = {};

// Middleware to get a PendingComplaint by ID
async function getPendingComplaintById(req, res, next) {
    let pendingComplaint;
    try {
        pendingComplaint = await PendingComplaints.findById(req.params.id);
        if (!pendingComplaint) {
            return res.status(404).json({ message: 'Pending Complaint not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.pendingComplaint = pendingComplaint;
    next();
}

// Middleware to check for duplicate notification_complaintid
async function checkDuplicateComplaintId(req, res, next) {
    let pendingComplaint;
    try {
        pendingComplaint = await PendingComplaints.findOne({
            notification_complaintid: req.body.notification_complaintid
        });
        if (pendingComplaint && pendingComplaint._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate complaint ID found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}
router.post('/sendComplaintEmail', async (req, res) => {
    try {
        // 1. Destructure data coming from the frontend
        const {
            serialnumber,
            notificationtype,
            productgroup,
            problemtype,
            problemname,
            sparesrequested,
            breakdown,
            remark,
            user // User info included from frontend
        } = req.body;

        // 2. Find the equipment data by serial number
        const equipmentData = await Equipment.findOne({ serialnumber });
        if (!equipmentData) {
            return res
                .status(404)
                .json({ message: 'No equipment found for the provided serial number.' });
        }

        // 3. Combine the equipment data with the data from the frontend
        const combinedData = {
            complaintType: notificationtype,
            serialNo: serialnumber,
            productGroup: productgroup,
            problemType: problemtype,
            problemName: problemname,
            sparesrequested: sparesrequested,
            breakdown: breakdown,
            remark: remark,

            // Equipment Data
            description: equipmentData.materialdescription || '',
            partno: equipmentData.materialcode || '',
            customer: equipmentData.currentcustomer || '',

            // User (Service Engineer) Data
            serviceEngineer: {
                firstName: user.firstName || 'N/A',
                lastName: user.lastName || 'N/A',
                email: user.email || 'N/A',
                mobilenumber: user.mobilenumber || 'N/A',
                branch: user.branch || 'N/A'
            }
        };

        // 4. Find customer details (hospital name & city) using the customer code from equipmentData
        const foundCustomer = await Customer.findOne({ customercodeid: combinedData.customer });
        // Default values if customer is not found
        let finalHospitalName = 'N/A';
        let finalCity = 'N/A';

        if (foundCustomer) {
            finalHospitalName = foundCustomer.hospitalname || 'N/A';
            finalCity = foundCustomer.city || 'N/A';
        }

        // 5. Construct the email body including hospital name and city after customer
        const emailBody =
            `Dear CIC,

Please create a new complaint as below

Complaint Type : ${combinedData.complaintType}
Serial No : ${combinedData.serialNo}
Description : ${combinedData.description}
ProductGroup : ${combinedData.productGroup}
ProblemType : ${combinedData.problemType}
Part No : ${combinedData.partno}
Customer : ${combinedData.customer}
Hospital Name : ${finalHospitalName}
City : ${finalCity}
ProblemName : ${combinedData.problemName}
SparesRequested : ${combinedData.sparesrequested}
Breakdown : ${combinedData.breakdown ? 'Yes' : 'No'}
Remarks : ${combinedData.remark}

----------------------------------------------------
Service Engineer Details:
Name : ${combinedData.serviceEngineer.firstName} ${combinedData.serviceEngineer.lastName}
Email : ${combinedData.serviceEngineer.email}
Mobile Number : ${combinedData.serviceEngineer.mobilenumber}
Branch : ${combinedData.serviceEngineer.branch}
----------------------------------------------------

Regards,
Skanray Service Support Team

Please consider the Environment before printing this e-mail.`;

        // 6. Configure nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'webadmin@skanray-access.com',
                pass: 'rdzegwmzirvbjcpm'
            },
        });

        // 7. Set up mail options
        const mailOptions = {
            from: 'webadmin@skanray-access.com',
            to: 'mrshivamtiwari2025@gmail.com', // Recipient email
            subject: 'New Complaint',
            text: emailBody,
        };

        // 8. Send the email
        await transporter.sendMail(mailOptions);

        // 9. Send a success response to the frontend
        return res.status(200).json({
            message: 'Email sent successfully.',
            combinedData, // Returning the full data for verification
        });

    } catch (error) {
        console.error('Error sending complaint email:', error);
        return res.status(500).json({
            message: 'Error sending email',
            error: error.message
        });
    }
});

router.post('/sendUpdatedComplaintEmail', async (req, res) => {
    try {
        // 1. Destructure fields from the request body
        const {
            notification_no,
            serial_no,
            description,
            part_no,
            // 'customer' here is the customer code we receive from frontend
            // which we'll use to look up the actual hospital name & city
            customer,
            name,
            city,
            serviceEngineer,
            spareRequested,
            remarks,
            serviceEngineerMobile,
            serviceEngineerEmail,
            branchName
        } = req.body;

        // 2. Look up the customer in the DB by its code
        const foundCustomer = await Customer.findOne({ customercodeid: customer });

        // 3. If found, override 'name' and 'city' with DB values
        let finalHospitalName = name;
        let finalCity = city;

        if (foundCustomer) {
            finalHospitalName = foundCustomer.hospitalname || name;
            finalCity = foundCustomer.city || city;
        }

        // 4. Build the HTML email
        const emailHTML = `
            <div style="font-family: Arial, sans-serif; margin: 20px;">
              <p>Dear CIC,</p>
              <p>Please Update the notification int as below</p>
              <table style="border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px;">Notification No:</td>
                  <td style="padding: 4px;">${notification_no}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Serial no:</td>
                  <td style="padding: 4px;">${serial_no}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Description:</td>
                  <td style="padding: 4px;">${description}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Part no:</td>
                  <td style="padding: 4px;">${part_no}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Customer Code:</td>
                  <td style="padding: 4px;">${customer}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Name (Hospital):</td>
                  <td style="padding: 4px;">${finalHospitalName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">City:</td>
                  <td style="padding: 4px;">${finalCity}</td>
                </tr>
                 <tr>
                  <td style="padding: 4px;">Spare Requested:</td>
                  <td style="padding: 4px;">${spareRequested}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Remarks:</td>
                  <td style="padding: 4px;">${remarks}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Service Engineer:</td>
                  <td style="padding: 4px;">${serviceEngineer}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Service Engineer Mobile:</td>
                  <td style="padding: 4px;">${serviceEngineerMobile}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Service Engineer Email:</td>
                  <td style="padding: 4px;">${serviceEngineerEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 4px;">Branch Name:</td>
                  <td style="padding: 4px;">${branchName}</td>
                </tr>
              </table>
              <br />
              <p>Regards,<br />Skanray Service Support Team</p>
              <p>Please consider the Environment before printing this e-mail.</p>
            </div>
        `;

        // 5. Configure nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'webadmin@skanray-access.com',
                pass: 'rdzegwmzirvbjcpm'
            },
        });

        // 6. Set up mail options
        const mailOptions = {
            from: 'webadmin@skanray-access.com',
            to: 'mrshivamtiwari2025@gmail.com', // Adjust as needed
            subject: 'Updated Complaint',
            html: emailHTML
        };

        // 7. Send the email
        await transporter.sendMail(mailOptions);

        // 8. Return success response
        return res.status(200).json({
            message: 'Updated complaint email sent successfully.',
            dataSent: req.body,
        });

    } catch (error) {
        console.error('Error sending updated complaint email:', error);
        return res.status(500).json({
            message: 'Error sending updated complaint email',
            error: error.message
        });
    }
});
// PATCH request to update `requesteupdate` field to true
router.patch('/pendingcomplaints/:id/requestupdate', getPendingComplaintById, async (req, res) => {
    // Set requesteupdate to true
    res.pendingComplaint.requesteupdate = true;

    // Update status if provided in the request body
    if (req.body.status != null) {
        res.pendingComplaint.status = req.body.status;
    }

    // Update remark if provided in the request body
    if (req.body.remark != null) {
        res.pendingComplaint.remark = req.body.remark;
    }

    // Update sparerequest if provided in the request body
    if (req.body.sparerequest != null) {
        res.pendingComplaint.sparerequest = req.body.sparerequest;
    }

    // Update modifiedAt timestamp
    res.pendingComplaint.modifiedAt = Date.now();

    try {
        const updatedPendingComplaint = await res.pendingComplaint.save();
        res.json(updatedPendingComplaint);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// GET all PendingComplaints
router.get('/pendingcomplaints', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const pendingComplaints = await PendingComplaints.find().skip(skip).limit(limit);
        const totalPendingComplaints = await PendingComplaints.countDocuments();
        const totalPages = Math.ceil(totalPendingComplaints / limit);

        res.json({
            pendingComplaints,
            totalPages,
            totalPendingComplaints
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// GET PendingComplaint by ID
router.get('/pendingcomplaints/:id', getPendingComplaintById, (req, res) => {
    res.json(res.pendingComplaint);
});

// CREATE a new PendingComplaint
router.post('/pendingcomplaints', async (req, res) => {
    const pendingComplaint = new PendingComplaints({
        notificationtype: req.body.notificationtype,
        notification_complaintid: req.body.notification_complaintid,
        notificationdate: req.body.notificationdate,
        userstatus: req.body.userstatus,
        materialdescription: req.body.materialdescription,
        serialnumber: req.body.serialnumber,
        devicedata: req.body.devicedata,
        salesoffice: req.body.salesoffice,
        materialcode: req.body.materialcode,
        reportedproblem: req.body.reportedproblem,
        dealercode: req.body.dealercode,
        customercode: req.body.customercode,
        partnerresp: req.body.partnerresp,
        breakdown: req.body.breakdown,
        status: req.body.status,
        productgroup: req.body.productgroup,
        problemtype: req.body.problemtype,
        problemname: req.body.problemname,
        sparerequest: req.body.sparerequest,
        remark: req.body.remark
    });
    try {
        const newPendingComplaint = await pendingComplaint.save();
        res.status(201).json(newPendingComplaint);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a PendingComplaint
router.put(
    "/pendingcomplaints/:id",
    getPendingComplaintById,
    async (req, res) => {
        // Update existing fields if they exist in req.body:
        if (req.body.notificationtype != null) {
            res.pendingComplaint.notificationtype = req.body.notificationtype;
        }
        if (req.body.notification_complaintid != null) {
            res.pendingComplaint.notification_complaintid = req.body.notification_complaintid;
        }
        if (req.body.notificationdate != null) {
            res.pendingComplaint.notificationdate = req.body.notificationdate;
        }
        if (req.body.userstatus != null) {
            res.pendingComplaint.userstatus = req.body.userstatus;
        }
        if (req.body.materialdescription != null) {
            res.pendingComplaint.materialdescription = req.body.materialdescription;
        }
        if (req.body.serialnumber != null) {
            res.pendingComplaint.serialnumber = req.body.serialnumber;
        }
        if (req.body.devicedata != null) {
            res.pendingComplaint.devicedata = req.body.devicedata;
        }
        if (req.body.salesoffice != null) {
            res.pendingComplaint.salesoffice = req.body.salesoffice;
        }
        if (req.body.materialcode != null) {
            res.pendingComplaint.materialcode = req.body.materialcode;
        }
        if (req.body.reportedproblem != null) {
            res.pendingComplaint.reportedproblem = req.body.reportedproblem;
        }
        if (req.body.dealercode != null) {
            res.pendingComplaint.dealercode = req.body.dealercode;
        }
        if (req.body.customercode != null) {
            res.pendingComplaint.customercode = req.body.customercode;
        }
        if (req.body.partnerresp != null) {
            res.pendingComplaint.partnerresp = req.body.partnerresp;
        }
        if (req.body.breakdown != null) {
            res.pendingComplaint.breakdown = req.body.breakdown;
        }
        if (req.body.status != null) {
            res.pendingComplaint.status = req.body.status;
        }

        // NEW FIELDS: Spares required, problem type, problem name, remarks, etc.
        if (req.body.sparerequest != null) {
            res.pendingComplaint.sparerequest = req.body.sparerequest;
        }
        if (req.body.problemtype != null) {
            res.pendingComplaint.problemtype = req.body.problemtype;
        }
        if (req.body.problemname != null) {
            res.pendingComplaint.problemname = req.body.problemname;
        }
        if (req.body.remark != null) {
            res.pendingComplaint.remark = req.body.remark;
        }
        if (req.body.requesteupdate != null) {
            res.pendingComplaint.requesteupdate = req.body.requesteupdate;
        }

        // Always update the modification timestamp
        res.pendingComplaint.modifiedAt = Date.now();

        try {
            const updatedPendingComplaint = await res.pendingComplaint.save();
            res.json(updatedPendingComplaint);
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }
);


// DELETE a PendingComplaint
router.delete('/pendingcomplaints/:id', getPendingComplaintById, async (req, res) => {
    try {
        const deletedPendingComplaint = await PendingComplaints.deleteOne({ _id: req.params.id });
        if (deletedPendingComplaint.deletedCount === 0) {
            return res.status(404).json({ message: 'Pending Complaint Not Found' });
        }
        res.json({ message: 'Deleted Pending Complaint' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/pendinginstallationsearch', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({ message: 'query parameter is required' })
        }

        const query = {
            $or: [
                { notificationtype: { $regex: q, $options: 'i' } },
                { notification_complaintid: { $regex: q, $options: 'i' } },
                { materialdescription: { $regex: q, $options: 'i' } },
                { serialnumber: { $regex: q, $options: 'i' } },
                { devicedata: { $regex: q, $options: 'i' } },
                { salesoffice: { $regex: q, $options: 'i' } },
                { materialcode: { $regex: q, $options: 'i' } },
                { reportedproblem: { $regex: q, $options: 'i' } },
                { dealercode: { $regex: q, $options: 'i' } },
                { customercode: { $regex: q, $options: 'i' } },
                { partnerresp: { $regex: q, $options: 'i' } },
            ]
        }
        const pendingComplaint = await PendingComplaints.find(query)
        res.json(pendingComplaint)

    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})



router.post("/sendOtpEmail", async (req, res) => {
    try {
        const { customerEmail } = req.body;

        if (!customerEmail) {
            return res
                .status(400)
                .json({ message: "customerEmail is required in the request body." });
        }

        // Generate a 6-digit OTP
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

        // Set an expiration time (e.g. 10 minutes from now)
        const expiresAt = Date.now() + 10 * 60 * 1000;

        // Store it in memory
        otpStore[customerEmail] = {
            otp: generatedOtp,
            expiresAt,
        };

        // Send the OTP via email
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: "webadmin@skanray-access.com",
                pass: "rdzegwmzirvbjcpm", // example password/app password
            },
        });

        const mailOptions = {
            from: "webadmin@skanray-access.com",
            to: customerEmail, // send to the customer's email
            subject: "Your OTP Code",
            text: `Dear Customer,\n\nYour OTP is: ${generatedOtp}\n\nThis code will expire in 10 minutes.\n\nRegards,\nSkanray Service Support Team`,
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({
            message: "OTP sent successfully to customer email.",
            email: customerEmail,
        });
    } catch (error) {
        console.error("Error sending OTP email:", error);
        return res.status(500).json({
            message: "Error sending OTP email",
            error: error.message,
        });
    }
});
// (A) Function that generates only the "Incident Reporting Form" HTML
function generateIncidentReportHTML(injuryDetails = {}) {
    const {
      deviceUsers = {},
      deviceUserRemarks = "",
      incidentDuringProcedure = "", // "yes" or "no"
      exposureProtocol = {},
      outcomeAttributed = "",
      description = "",
    } = injuryDetails;
  
    // (1) Device User / Affected Person
    // Show only the ones that are true
    const deviceUserList = [];
    if (deviceUsers.healthcareProfessional) deviceUserList.push("Healthcare Professional");
    if (deviceUsers.patient) deviceUserList.push("Patient");
    if (deviceUsers.unauthorizedUser) deviceUserList.push("Unauthorized User");
    if (deviceUsers.operator) deviceUserList.push("Operator");
    if (deviceUsers.serviceEngineer) deviceUserList.push("Service Engineer");
    if (deviceUsers.none) deviceUserList.push("None");
  
    const deviceUsersHTML = deviceUserList
      .map((user) => `<li>${user}</li>`)
      .join("");
  
    // (3) Exposure Protocol
    const exposureItems = [];
    if (exposureProtocol.kv) exposureItems.push("kV");
    if (exposureProtocol.maMas) exposureItems.push("mA/mAs");
    if (exposureProtocol.distance) exposureItems.push("Distance from X-Ray Source");
    if (exposureProtocol.time) exposureItems.push("Time");
  
    const exposureHTML = exposureItems
      .map((item) => `<li>${item}</li>`)
      .join("");
  
    // (2) Did incident occur during procedure?
    // Instead of radio buttons, just show bullet "Yes" or "No".
    const incidentDuringProcedureHTML = `
      <ul style="list-style-type: disc; padding-left: 20px;">
        <li>${incidentDuringProcedure === "yes" ? "Yes" : "No"}</li>
      </ul>
    `;
  
    // Build the "Incident Reporting Form" HTML (for PDF)
    return `
      <div
        id="pdf-content"
        class="report-container"
        style="padding: 20px; margin: 20px; border: 1px solid red"
      >
        <!-- Header Section -->
        <table>
          <tr>
            <td style="width: 15%; text-align: center">
              <div>
                <img
                  src="https://skanray.com/wp-content/uploads/2024/07/Skanray-logo.png"
                  alt="Company Logo"
                  style="height: 100px; margin: 5px"
                />
              </div>
            </td>
            <td style="width: 85%; text-align: left; padding: 10px">
              <strong style="font-size: 2em">Incident Reporting Form</strong>
            </td>
          </tr>
        </table>
  
        <table style="margin-bottom: 20px">
          <tr>
            <td style="width: 50%">Format#F3211</td>
            <td style="text-align: start">Rev#1.0</td>
          </tr>
        </table>
  
        <!-- Main Form Section -->
        <table style="width: 100%; border: 1px solid #000; border-collapse: collapse;">
          <!-- (1) Device User / Affected person -->
          <tr>
            <td colspan="2" style="padding: 8px; border: 1px solid #000;">
              <strong>1) Device User / Affected person</strong>
              <p style="margin: 5px 0">
                Indicate the User of the device at the time of the event, 'None'
                means that the problem is not related to type (Multiple selection)
                <br />
                Remarks for 'limited char': ${deviceUserRemarks || "N/A"}
              </p>
              <ul
                style="
                  display: grid;
                  grid-template-columns: repeat(3, 1fr);
                  gap: 10px;
                  padding: 10px;
                  list-style-type: disc;
                "
              >
                ${
                  deviceUsersHTML ||
                  "<li style='color: #999;'>No device user was marked as true</li>"
                }
              </ul>
            </td>
          </tr>
  
          <!-- (2) Did incident occur during procedure? -->
          <tr>
            <td style="width: 50%; vertical-align: top; padding: 8px; border: 1px solid #000;">
              <strong>2) Did incident occur during procedure?</strong>
              ${incidentDuringProcedureHTML}
            </td>
  
            <!-- (3) Exposure Protocol -->
            <td style="width: 50%; vertical-align: top; padding: 8px; border: 1px solid #000;">
              <strong>3) Provide user/equipment exposure protocol</strong>
              <span style="display: block; font-size: 90%;">
                (Need to be added for CG products)
              </span>
              <ul
                style="
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 10px;
                  padding: 10px;
                  list-style-type: disc;
                "
              >
                ${
                  exposureHTML ||
                  "<li style='color: #999;'>No exposure protocol selected</li>"
                }
              </ul>
            </td>
          </tr>
  
          <!-- (4) Outcome Attributed to Event -->
          <tr>
            <td colspan="2" style="padding: 8px; border: 1px solid #000;">
              <strong>4) Outcome Attributed to Event</strong>
              <p style="margin: 5px 0; font-size: 90%;">
                (Red coloured communication sent to Factory team after SFR closer
                and also for engraving with the OTP - this information remains relevant)
              </p>
  
              <!-- Just show whatever was chosen -->
              <ul style="padding: 10px; list-style-type: none;">
                <li>➡ ${outcomeAttributed || "N/A"}</li>
              </ul>
  
              <!-- Description (Required) -->
              <div style="margin-top: 10px">
                <label style="display: block; margin-bottom: 5px">
                  <strong>Description (Required):</strong>
                </label>
                <div
                  name="description"
                  style="
                    width: 100%;
                    min-height: 100px;
                    background: rgb(227, 226, 226);
                    border-radius: 3px;
                    padding: 5px;
                  "
                >${description || ""}</div>
              </div>
            </td>
          </tr>
        </table>
      </div>
    `;
  }
  
  // (B) Your POST route:
  router.post("/verifyOtpAndSendFinalEmail", async (req, res) => {
    try {
      const {
        customerEmail,
        otp,
        complaintNumber,
        notificationDate,
        serialNumber,
        reportedProblem,
        actionTaken,
        instructionToCustomer,
        sparesReplaced,
        serviceEngineer,
        // The injuryDetails object for the PDF
        injuryDetails,
      } = req.body;
  
      // === 1) Verify OTP logic (same as your code) ===
      const otpData = otpStore[customerEmail];
      if (!otpData) {
        return res
          .status(400)
          .json({ message: "No OTP found for this customer email." });
      }
      if (Date.now() > otpData.expiresAt) {
        delete otpStore[customerEmail];
        return res
          .status(400)
          .json({ message: "OTP has expired. Please request a new one." });
      }
      if (otpData.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP." });
      }
      delete otpStore[customerEmail];
  
      // === 2) Build the spares replaced table for the email body ===
      let sparesHTML = "";
      if (Array.isArray(sparesReplaced) && sparesReplaced.length > 0) {
        const rowsHTML = sparesReplaced
          .map((item, index) => {
            return `
              <tr>
                <td style="padding: 4px; border: 1px solid #ccc;">${index + 1}</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${item.PartNumber || ""}</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${item.Description || ""}</td>
                <td style="padding: 4px; border: 1px solid #ccc;">${item.remark || ""}</td>
              </tr>
            `;
          })
          .join("");
  
        sparesHTML = `
          <p><strong>Spares Replaced:</strong></p>
          <table style="border: 1px solid #ccc; border-collapse: collapse;">
            <tr>
              <th style="padding: 4px; border: 1px solid #ccc;">Sl. No</th>
              <th style="padding: 4px; border: 1px solid #ccc;">Part Number</th>
              <th style="padding: 4px; border: 1px solid #ccc;">Description</th>
              <th style="padding: 4px; border: 1px solid #ccc;">Remark</th>
            </tr>
            ${rowsHTML}
          </table>
          <br/>
        `;
      }
  
      // === 3) Build the "Incident Reporting Form" HTML for PDF only ===
      const incidentReportHTML = generateIncidentReportHTML(injuryDetails);
  
      // === 4) Build the *email body* (do NOT include the incident form) ===
      const emailBodyHTML = `
        <div style="font-family: Arial, sans-serif; margin: 10px;">
          <p><strong>Kindly Close,</strong></p>
          <p>Dear CIC, Notification as below:</p>
          <table style="border-collapse: collapse;">
            <tr>
              <td style="padding: 4px;"><strong>Notification No:</strong></td>
              <td style="padding: 4px;">${complaintNumber || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 4px;"><strong>Notification Date:</strong></td>
              <td style="padding: 4px;">${notificationDate || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 4px;"><strong>Serial No:</strong></td>
              <td style="padding: 4px;">${serialNumber || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 4px;"><strong>Problem Reported:</strong></td>
              <td style="padding: 4px;">${reportedProblem || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 4px;"><strong>Action Taken:</strong></td>
              <td style="padding: 4px;">${actionTaken || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 4px;"><strong>Instruction to Customer:</strong></td>
              <td style="padding: 4px;">${instructionToCustomer || "N/A"}</td>
            </tr>
          </table>
          <br/>
          
          ${sparesHTML}
  
          <p><strong>Service Engineer Name:</strong>
            ${
              serviceEngineer?.firstName && serviceEngineer?.lastName
                ? `${serviceEngineer.firstName} ${serviceEngineer.lastName}`
                : "N/A"
            }
          </p>
          <p><strong>Service Engineer Phone:</strong> ${
            serviceEngineer?.mobileNumber || "N/A"
          }</p>
          <p><strong>Service Engineer Email:</strong> ${
            serviceEngineer?.email || "N/A"
          }</p>
  
          <p>The <strong>Incident Reporting Form</strong> is attached below as a PDF report.</p>
  
          <p>Please consider the Environment before printing this e-mail.</p>
        </div>
      `;
  
      // === 5) Generate a PDF from incidentReportHTML ===
      const pdfOptions = {
        format: "A4",
        border: {
          top: "10px",
          right: "10px",
          bottom: "10px",
          left: "10px",
        },
      };
  
      pdf.create(incidentReportHTML, {
        format: "A4",
        childProcessOptions: {
            env: {
                OPENSSL_CONF: '/dev/null',  // Bypassing OpenSSL configuration issues
            },
        },
    }).toBuffer(async (err, pdfBuffer) => {
        if (err) {
            console.error("Error generating PDF:", err);
            return res
                .status(500)
                .json({ message: "Failed to generate PDF", error: err.message });
        }
  
        try {
          // === 6) Send via Nodemailer with the PDF as an attachment ===
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: "webadmin@skanray-access.com",
              pass: "rdzegwmzirvbjcpm",
            },
          });
  
          const mailOptions = {
            from: "webadmin@skanray-access.com",
            to: [customerEmail, "mrshivamtiwari2025@gmail.com"], // or whichever recipients
            subject: "Final Complaint Details with Incident Report",
            html: emailBodyHTML, // Email body (no incident form)
            attachments: [
              {
                filename: "IncidentReportingForm.pdf",
                content: pdfBuffer,
              },
            ],
          };
  
          await transporter.sendMail(mailOptions);
  
          return res.status(200).json({
            message: "OTP verified, email sent successfully with PDF attached!",
            finalData: req.body,
          });
        } catch (emailErr) {
          console.error("Error sending email:", emailErr);
          return res.status(500).json({
            message: "Error sending final email",
            error: emailErr.message,
          });
        }
      });
    } catch (error) {
      console.error("Error verifying OTP and sending final email:", error);
      return res.status(500).json({
        message: "Error verifying OTP or sending final email",
        error: error.message,
      });
    }
  });
  

module.exports = router;
