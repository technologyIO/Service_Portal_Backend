const express = require('express');
const router = express.Router();
const PendingComplaints = require('../../Model/UploadSchema/PendingCompliantsSchema');
const nodemailer = require('nodemailer');
const Equipment = require('../../Model/MasterSchema/EquipmentSchema');
const Customer = require('../../Model/UploadSchema/CustomerSchema'); // Adjust the path as necessary
const pdf = require("html-pdf");
const User = require('../../Model/MasterSchema/UserSchema');
const cors = require('cors');
let otpStore = {};
const app = express();
app.options('*', cors());
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


router.post("/revise/:notificationId", async (req, res) => {
  const { notificationId } = req.params;

  try {
    // Find the complaint by notification_complaintid
    const complaint = await PendingComplaints.findOne({
      notification_complaintid: notificationId,
    });

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Increment rev and update modifiedAt
    complaint.rev = (complaint.rev || 0) + 1;
    complaint.modifiedAt = Date.now();

    await complaint.save();

    res.status(200).json({
      message: "Revision count updated",
      rev: complaint.rev,
    });
  } catch (error) {
    console.error("Error updating revision count:", error);
    res.status(500).json({ message: "Server error" });
  }
});


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
      userInfo: {
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
    let finalPhone = 'N/A';
    let finalEmail = 'N/A';
    let finalpincode = 'N/A';

    if (foundCustomer) {
      finalHospitalName = foundCustomer.hospitalname || 'N/A';
      finalCity = foundCustomer.city || 'N/A';
      finalPhone = foundCustomer.telephone || 'N/A';
      finalEmail = foundCustomer.email || 'N/A';
      finalpincode = foundCustomer.postalcode || 'N/A';
    }

    // 5. Construct the HTML email body with improved design
    const emailBodyHtml = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; }
          .container { width: 80%; margin: 20px auto; border: 1px solid #ccc; padding: 20px; }
          .header { background-color: #f7f7f7; padding: 10px; text-align: center; }
          .section { margin-top: 20px; }
          .section h3 { border-bottom: 2px solid #333; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; }
          table th, table td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
          .footer { margin-top: 20px; font-size: 0.9em; color: #555; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Complaint Notification</h2>
          </div>

          <div class="section">
            <h3>Complaint Details</h3>
            <table>
              <tr>
                <th>Complaint Type</th>
                <td>${combinedData.complaintType}</td>
              </tr>
              <tr>
                <th>Serial No</th>
                <td>${combinedData.serialNo}</td>
              </tr>
              <tr>
                <th>Description</th>
                <td>${combinedData.description}</td>
              </tr>
              <tr>
                <th>Product Group</th>
                <td>${combinedData.productGroup}</td>
              </tr>
              <tr>
                <th>Problem Type</th>
                <td>${combinedData.problemType}</td>
              </tr>
              <tr>
                <th>Part No</th>
                <td>${combinedData.partno}</td>
              </tr>
              <tr>
                <th>Problem Name</th>
                <td>${combinedData.problemName}</td>
              </tr>
              <tr>
                <th>Spares Requested</th>
                <td>${combinedData.sparesrequested}</td>
              </tr>
              <tr>
                <th>Breakdown</th>
                <td>${combinedData.breakdown ? 'Yes' : 'No'}</td>
              </tr>
              <tr>
                <th>Remarks</th>
                <td>${combinedData.remark}</td>
              </tr>
            </table>
          </div>

          <div class="section">
            <h3>Customer Details</h3>
            <table>
              <tr>
                <th>Customer</th>
                <td>${combinedData.customer}</td>
              </tr>
              <tr>
                <th>Hospital Name</th>
                <td>${finalHospitalName}</td>
              </tr>
              <tr>
                <th>City</th>
                <td>${finalCity}</td>
              </tr>
              <tr>
                <th>Phone</th>
                <td>${finalPhone}</td>
              </tr>
              <tr>
                <th>Email</th>
                <td>${finalEmail}</td>
              </tr>
              <tr>
                <th>PinCode</th>
                <td>${finalpincode}</td>
              </tr>
            </table>
          </div>

          <div class="section">
            <h3>Service Engineer Details</h3>
            <table>
              <tr>
                <th>Name</th>
                <td>${combinedData.userInfo.firstName} ${combinedData.userInfo.lastName}</td>
              </tr>
              <tr>
                <th>Email</th>
                <td>${combinedData.userInfo.email}</td>
              </tr>
              <tr>
                <th>Mobile Number</th>
                <td>${combinedData.userInfo.mobilenumber}</td>
              </tr>
              <tr>
                <th>Branch</th>
                <td>${combinedData.userInfo.branch}</td>
              </tr>
            </table>
          </div>

          <div class="footer">
            <p>Regards,<br>Skanray Service Support Team</p>
            <p>Please consider the Environment before printing this e-mail.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // 6. Configure nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'webadmin@skanray-access.com',
        pass: 'rdzegwmzirvbjcpm'
      },
    });

    const cicUser = await User.findOne({
      'role.roleName': 'CIC',
      'role.roleId': 'C1'
    });

    if (!cicUser) {
      console.error("CIC user not found");
      return;
    }


    // 7. Set up mail options with the HTML body
    const mailOptions = {
      from: 'webadmin@skanray-access.com',
      to: 'ftshivamtiwari222@gmail.com',
      subject: 'New Complaint',
      html: emailBodyHtml,
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
      serviceEngineer,
      customer,
      name,
      city,
      userInfo,
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
      to: 'ftshivamtiwari222@gmail.com, Damodara.s@skanray.com, tomson.m+customer@skanray.com', // comma-separated string
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
router.get('/allpendingcomplaints', async (req, res) => {
  try {


    const pendingComplaints = await PendingComplaints.find();
    res.json({
      pendingComplaints,
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
router.get('/allpendingcomplaints/:employeeid?', async (req, res) => {
  try {
    const { employeeid } = req.params;

    if (employeeid) {
      // 1. Get the user
      const user = await User.findOne({ employeeid });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // 2. Extract part numbers from skills
      const partNumbers = [];
      user.skills.forEach(skill => {
        if (skill.partNumbers && skill.partNumbers.length > 0) {
          partNumbers.push(...skill.partNumbers);
        }
      });

      // 3. Extract branch names
      const branchNames = user.branch || [];

      // 4. Apply both filters: materialcode & salesoffice
      const pendingComplaints = await PendingComplaints.find({
        materialcode: { $in: partNumbers },
        salesoffice: { $in: branchNames }
      });

      return res.json({
        pendingComplaints,
        count: pendingComplaints.length,
        filteredByEmployee: true
      });
    }

    // Default: Return all complaints if no employeeid provided
    const pendingComplaints = await PendingComplaints.find();
    res.json({
      pendingComplaints,
      count: pendingComplaints.length,
      filteredByEmployee: false
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


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

router.get('/pendingcomplaintsearch', async (req, res) => {
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
                ${deviceUsersHTML ||
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
                ${exposureHTML ||
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
      notificationType,
      voltageLN_RY,
      voltageLG_YB,
      voltageNG_BR,
      sparesReplaced = [],          // Array of replaced parts
      userInfo,
      injuryDetails,
      customerDetails,
      description,          // e.g. { customerCode, hospitalName, street, city, phone, email }
      partNumber,                   // complaint's part number
      partDescription,              // description of the part
      customerRemarks,              // specific actions required from customer
      customerAdditionalRemarks,    // additional customer remarks if any
    } = req.body;

    // 1) Verify OTP
    const otpData = otpStore[customerEmail];
    if (!otpData) {
      return res.status(400).json({ message: "No OTP found for this customer email." });
    }
    if (Date.now() > otpData.expiresAt) {
      delete otpStore[customerEmail];
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }
    if (otpData.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }
    delete otpStore[customerEmail];

    // 2) Prepare date fields
    const dateAttended = new Date().toLocaleDateString("en-GB"); // e.g. "02/04/2025"
    const currentDate = new Date().toLocaleDateString("en-GB");

    // 3) Build the 5 rows for "Parts/Modules replaced"
    const maxRows = 5;
    let partsRowsHTML = "";
    for (let i = 0; i < maxRows; i++) {
      const item = sparesReplaced[i];
      if (item) {
        partsRowsHTML += `
        <tr>
          <td style="vertical-align: top; height: 20px;">${i + 1}</td>
          <td style="vertical-align: top;">${item.Description || ""}</td>
          <td style="vertical-align: top;">${item.defectivePartNumber || ""}</td>
          <td style="vertical-align: top;">${item.replacedPartNumber || ""}</td>
        </tr>
      `;
      } else {
        partsRowsHTML += `
        <tr>
          <td style="vertical-align: top; height: 20px;">${i + 1}</td>
          <td style="vertical-align: top;"></td>
          <td style="vertical-align: top;"></td>
          <td style="vertical-align: top;"></td>
        </tr>
      `;
      }
    }

    function formatExcelDate(serial) {
      if (!serial || isNaN(serial)) return "";

      const excelEpoch = new Date(1899, 11, 30);
      const days = Math.floor(serial);
      const milliseconds = (serial - days) * 24 * 60 * 60 * 1000;
      const date = new Date(excelEpoch.getTime() + days * 86400000 + milliseconds);

      // Format as dd-mm-yyyy
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }


    // 4) Build the Service Report HTML with compact styling
    const serviceReportHTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Skanray Service Report</title>
    <style>
      @page {
        size: A4;
        margin: 2mm;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
        font-size: 8px;
        line-height: 1.7;
      }
      .outer-container {
        width: 100%;
        max-width: 100%;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      table, td, th {
        border: 1px solid #000;
      }
      td, th {
        padding: 4px;
        vertical-align: top;
      }
      .main-title {
        font-size: 7px;
        font-weight: bold;
      }
      .sub-title {
        font-size: 6px;
        font-weight: bold;
      }
      .compact-row {
        height: 20px;
      }
      .small-text {
        font-size: 7px;
      }
    </style>
  </head>
  <body>
    <div class="outer-container">
      <!-- 1) Top Row: Logo + Title + Format/Number/Revision -->
      <table>
        <tr>
          <td style="width: 15%; text-align: center;">
            <img
              src="https://skanray.com/wp-content/uploads/2024/07/Skanray-logo.png"
              alt="Skanray Logo"
              style="width: 60px;"
            />
          </td>
          <td style="width: 60%; text-align: center;">
            <div class="main-title">Skanray Technologies Limited.</div>
            <div class="sub-title">Service Report</div>
          </td>
          <td style="width: 35%;">
            <table>
              <tr class="compact-row">
                <td>format</td>
                <td>Number</td>
                <td>3F5014</td>
              </tr>
              <tr class="compact-row">
                <td>&nbsp;</td>
                <td>Revision</td>
                <td>03</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- 2) Notification No / Date / Service Type -->
      <table>
        <tr class="compact-row">
          <td style="width: 16%;">Notification No:</td>
          <td style="width: 17%;">${complaintNumber || "N/A"}</td>
          <td style="width: 16%;">Date:</td>
          <td style="width: 17%;">
  ${currentDate}
</td>

          <td style="width: 17%;">Service Type:</td>
          <td style="width: 17%;">${notificationDate || "N/A"}</td>
        </tr>
      </table>

      <!-- 3) Customer Details + Part Details -->
      <table>
        <tr>
          <td style="width: 50%;">
            <strong>Customer Code:</strong> ${customerDetails?.customerCode || "N/A"}<br/>
            <strong>Name:</strong> ${customerDetails?.hospitalName || "N/A"}<br/>
            <strong>Address:</strong> ${customerDetails?.street || "N/A"}<br/>
            <strong>City:</strong> ${customerDetails?.city || "N/A"}<br/>
            <strong>Telephone:</strong> ${customerDetails?.phone || "N/A"}<br/>
            <strong>Email:</strong> ${customerDetails?.email || "N/A"}
          </td>
          <td style="width: 50%;">
            <table>
              <tr class="compact-row">
                <td><strong>Part Number:</strong></td>
                <td>${partNumber || "N/A"}</td>
              </tr>
              <tr class="compact-row">
                <td><strong>Description:</strong></td>
                <td>${description || "N/A"}</td>
              </tr>
              <tr class="compact-row">
                <td><strong>Serial Number:</strong></td>
                <td>${serialNumber || "N/A"}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Notification Details -->
      <table>
        <tr class="compact-row">
          <td style="width: 25%;">
            <strong>Date Attended:</strong> ${dateAttended}
          </td>
          <td style="width: 75%;">
            <strong>Problem Reported:</strong> ${reportedProblem || "N/A"}
          </td>
        </tr>
        <tr>
          <td style="width: 25%;">
            <strong>Problem Observed & Action Taken:</strong>
          </td>
          <td style="width: 75%;">
            ${actionTaken || "N/A"}
          </td>
        </tr>
      </table>

      <!-- Supply Voltage Table -->
      <table>
        <tr class="compact-row">
          <td><strong>Supply Voltage(V)</strong></td>
          <td>L-N/R-Y</td>
          <td>${voltageLN_RY || "N/A"}</td>
          <td>L-GY-B</td>
          <td>${voltageLG_YB || "N/A"}</td>
          <td>N-G/B-R</td>
          <td>${voltageNG_BR || "N/A"}</td>
        </tr>
      </table>

      <!-- Injury Details -->
      <table>
        <tr class="compact-row">
          <td colspan="2"><strong>Injury Details:</strong></td>
        </tr>
        <tr class="compact-row">
          <td style="width: 50%;">
            <strong>Device User / Affected Person:</strong>
            ${(() => {
        const users = [];
        if (injuryDetails?.deviceUsers?.healthcareProfessional) users.push("Healthcare Professional");
        if (injuryDetails?.deviceUsers?.patient) users.push("Patient");
        if (injuryDetails?.deviceUsers?.unauthorizedUser) users.push("Unauthorized User");
        if (injuryDetails?.deviceUsers?.operator) users.push("Operator");
        if (injuryDetails?.deviceUsers?.serviceEngineer) users.push("Service Engineer");
        if (injuryDetails?.deviceUsers?.none) users.push("None");
        return users.join(", ") || "N/A";
      })()}
          </td>
          <td style="width: 50%;">
            <strong>Did Incident occur during procedure:</strong>
            ${injuryDetails?.incidentDuringProcedure === "yes" ? "Yes" : "No"}
          </td>
        </tr>
        <tr class="compact-row">
          <td colspan="2">
            <strong>Provide usage protocol:</strong>
            KV ${injuryDetails?.exposureProtocol?.kv || "____"}
            &nbsp;mA/mAs ${injuryDetails?.exposureProtocol?.maMas || "____"}
            &nbsp;Distance from X-Ray Source ${injuryDetails?.exposureProtocol?.distance || "____"}
            &nbsp;Time ${injuryDetails?.exposureProtocol?.time || "____"}
          </td>
        </tr>
        <tr class="compact-row">
          <td colspan="2">
            <strong>Outcome Attributed to Event:</strong>
            ${injuryDetails?.outcomeAttributed || "N/A"}
          </td>
        </tr>
        <tr class="compact-row">
          <td colspan="2">
            <strong>Describe injury/Treatment or other safety issues:</strong>
            ${injuryDetails?.description || "N/A"}
          </td>
        </tr>
      </table>

      <!-- Parts/Modules replaced -->
      <table>
        <tr class="compact-row">
          <td colspan="4">
            <strong>Details of Parts/Modules/Sub-assemblies replaced (Write NA if serial number is not available)</strong>
          </td>
        </tr>
        <tr class="compact-row">
          <th style="width: 10%;">SL.No</th>
          <th style="width: 35%;">Part Description</th>
          <th style="width: 25%;">Defective part serial number</th>
          <th style="width: 30%;">Replaced part Serial number</th>
        </tr>
        ${partsRowsHTML}
      </table>

      <!-- Service Engineer and Customer Remarks -->
      <table>
        <tr class="compact-row">
          <td style="width: 50%;">
            <strong>Service Engineer's Name:</strong><br/>
            ${userInfo?.firstName || "N/A"} ${userInfo?.lastName || ""}
            <br/>
            ${userInfo?.location || ""}
          </td>
          <td style="width: 50%;">
            <strong>Specific actions required from customer:</strong><br/>
            ${instructionToCustomer || "N/A"}
          </td>
        </tr>
        <tr class="compact-row">
          <td colspan="2">
            <strong>Customer Remark's:</strong><br/>
            <strong>The above equipment has been handed over to us in satisfactorily working condition</strong>
          </td>
        </tr>
        <tr class="compact-row">
          <td style="width: 50%;">
            <strong>
              Digitally Authorised by ${customerDetails?.hospitalName || "N/A"}
              by providing OTP ${otp} sent on ${currentDate}
              to ${customerEmail} and ${customerDetails?.phone || "N/A"} by Skanray
            </strong>
          </td>
          <td style="width: 30%; padding-left: 50px;">
            <p style="font-weight: bold; margin: 0;">Signature valid</p>
            <div class="small-text">
              Digitally signed by <br/>
              SKANRAY TECHNOLOGIES LIMITED <br/>
              P1 ${currentDate}
            </div>
            <img
              src="https://www.iconpacks.net/icons/2/free-check-icon-3278-thumb.png"
              alt="Signature Check"
              style="width: 40px; margin-top: -50px; margin-left: 80px;"
            />
          </td>
        </tr>
      </table>

      <!-- Payment and Terms -->
      <table>
        <tr>
          <td class="small-text">
            <div style="border-bottom: 1px solid black; padding-left: 5px;  ">
              <strong>
                Payments to be made through Cheque / DD in favour of Skanray Technologies Limited. only<br/>
              </strong>
            </div>
            <div style="border-bottom: 1px solid black; padding-left: 5px;">
              <strong>
                TERMS FOR ON-CALL SERVICE<br/>
                Payment: Full Payment as per the rate schedule available with the engineer should be made in advance.<br/>
                Agreements: The forgoing terms & conditions shall prevail not withstanding any variations contained in any document received from any customer unless such variations have been specifically agreed upon in writing by Skanray Technologies Limited<br/>
              </strong>
            </div>
            <div style="padding-left: 5px;">
              <strong>
                Customer Interaction Center (CIC) Toll Free No : 1800-425-7022 &nbsp; Email : cic@skanray.com
              </strong>
            </div>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>
`;

    // 5) Set PDF file name
    const pdfFileName = `${complaintNumber || "report"}_${(description || "description").replace(/\s+/g, "_")}.pdf`;

    // 6) Generate PDF with adjusted settings
    pdf.create(serviceReportHTML, {
      format: "A4",
      orientation: "portrait",
      border: {
        top: "2mm",
        right: "2mm",
        bottom: "2mm",
        left: "2mm",
      },
      zoomFactor: 1.0,
      childProcessOptions: {
        env: {
          OPENSSL_CONF: "/dev/null",
        },
      },
    }).toBuffer(async (err, pdfBuffer) => {
      if (err) {
        console.error("Error generating PDF:", err);
        return res.status(500).json({
          message: "Failed to generate PDF",
          error: err.message,
        });
      }

      try {
        // 7) Send email with the PDF as an attachment
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: "webadmin@skanray-access.com",
            pass: "rdzegwmzirvbjcpm",
          },
        });

        const toEmails = [
          userInfo?.dealerEmail,
          userInfo?.email,
          ...(Array.isArray(userInfo.manageremail)
            ? userInfo.manageremail
            : userInfo.manageremail
              ? [userInfo.manageremail]
              : []),
          'ftshivamtiwari222@gmail.com',
          // 'Damodara.s@skanray.com'
        ].filter(Boolean);
        console.log("Sending email to:", toEmails.join(", "));

        const mailOptions = {
          from: "webadmin@skanray-access.com",
          to: toEmails,
          subject: "Final Complaint Details with Service Report",
          html: `
          <div style="font-family: Arial, sans-serif; margin: 10px; font-size:16px;">
            <p><strong>Kindly Close,</strong></p>
            <p>Dear CIC, Notification as below:</p>
            <table style="border-collapse: collapse; font-size:16px;">
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
            <p><strong>Service Engineer Name:</strong> ${userInfo?.firstName && userInfo?.lastName
              ? `${userInfo.firstName} ${userInfo.lastName}`
              : "N/A"
            }</p>
            <p><strong>Service Engineer Phone:</strong> ${userInfo?.mobileNumber || "N/A"
            }</p>
            <p><strong>Service Engineer Email:</strong> ${userInfo?.email || "N/A"
            }</p>
            <p>The <strong>Service Report</strong> is attached below as a PDF report.</p>
            <p>Please consider the Environment before printing this e-mail.</p>
          </div>
        `,
          attachments: [
            {
              filename: pdfFileName,
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
