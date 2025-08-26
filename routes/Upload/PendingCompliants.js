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

const mongoose = require('mongoose');

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

// BULK DELETE Pending Complaints entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/pendingcomplaints/bulk', async (req, res) => {
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

    // Delete multiple pending complaints
    const deleteResult = await PendingComplaints.deleteMany({
      _id: { $in: validIds }
    });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        message: 'No pending complaints found to delete',
        deletedCount: 0
      });
    }

    res.json({
      message: `Successfully deleted ${deleteResult.deletedCount} pending complaints`,
      deletedCount: deleteResult.deletedCount,
      requestedCount: validIds.length
    });

  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

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

      // User (Service Engineer/Dealer) Data
      userInfo: {
        firstName: user.firstName || 'N/A',
        lastName: user.lastName || 'N/A',
        email: user.email || 'N/A',
        usertype: user.usertype || 'N/A',
        dealerEmail: user.dealerEmail || 'N/A',
        mobilenumber: user.mobilenumber || 'N/A',
        branch: Array.isArray(user.branch) ? user.branch.join(', ') : (user.branch || 'N/A'),
        manageremail: user.manageremail || []
      }
    };

    // 4. Find customer details using the customer code from equipmentData
    const foundCustomer = await Customer.findOne({ customercodeid: combinedData.customer });

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

    // Determine engineer title based on usertype
    const engineerTitle = combinedData.userInfo.usertype === 'dealer'
      ? 'Dealer Service Engineer'
      : 'Service Engineer';

    const emailBodyHtml = `
  <html>
  <head>
    <style>
      body { 
        font-family: Arial, sans-serif; 
        color: #000; 
        margin: 0; 
        padding: 0; 
        background-color: #ffffff;
      }
      .container { 
        background-color: white;
        max-width: 800px; 
        margin: 0; 
        padding: 0;
        border: none;
      }
      .header { 
        background-color: #00ff00; 
        color: black; 
        padding: 3px 8px; 
        font-weight: bold;
        font-size: 12px;
        margin: 0;
      }
      .content { 
        padding: 15px; 
        line-height: 1.6;
        font-size: 14px;
        font-family: Arial, sans-serif;
      }
      .field { 
        margin: 2px 0;
        font-size: 14px;
      }
      .field-label { 
        font-weight: normal; 
        display: inline;
      }
      .field-value { 
        display: inline;
        font-weight: normal;
      }
      .highlight-yellow { 
        background-color: #ffff00; 
        padding: 0px 2px;
        font-weight: bold;
      }
      .highlight-blue { 
        background-color: #0066ff; 
        color: white; 
        padding: 0px 2px;
        font-weight: bold;
      }
      .highlight-green { 
        background-color: #00ff00; 
        color: black; 
        padding: 0px 2px;
        font-weight: bold;
      }
      .vendor-section {
        background-color: #00ff00;
        color: black;
        padding: 3px 8px;
        margin: 15px 0 0 0;
        font-weight: bold;
        font-size: 12px;
      }
      .greeting {
        margin: 10px 0;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      
      <div class="content">
        <div class="greeting"><strong>Dear CIC,</strong></div>
        <div class="greeting">Please create a new complaint as below</div>
        
        <div class="field">
          Complaint Type : <span class="highlight-yellow">${combinedData.complaintType}</span>
        </div>
        
        <div class="field">
          Serial no : ${combinedData.serialNo}
        </div>
        
        <div class="field">
          Description : ${combinedData.description}
        </div>
        
        <div class="field">
          Part no : ${combinedData.partno}
        </div>
        
        <div class="field">
          Customer : ${combinedData.customer}
        </div>
        
        <div class="field">
          Name : ${finalHospitalName}
        </div>
        
        <div class="field">
          City : <span class="highlight-blue">${finalCity}</span>
        </div>
        
        <div class="field">
          Problem reported : <span class="highlight-green">${combinedData.problemType} | ${combinedData.problemName}</span>
        </div>
        
        <div class="field">
          Breakdown : ${combinedData.breakdown ? 'Y' : 'N'}
        </div>
        
        <div class="field">
          Remarks : ${combinedData.remark}
        </div>
        
        <div class="field">
          ${engineerTitle} : ${combinedData.userInfo.firstName} ${combinedData.userInfo.lastName}
        </div>
        
        <div class="field">
          ${engineerTitle} Mobile : ${combinedData.userInfo.mobilenumber}
        </div>
        
        <div class="field">
          ${engineerTitle} Email : ${combinedData.userInfo.email}
        </div>
        
        ${combinedData.sparesrequested ? `
        <div class="field">
          Spares Requested : ${combinedData.sparesrequested}
        </div>
        ` : ''}
      </div>
      
      <div class="vendor-section">
        Vendor Details ✓ Vendor Code / Vendor Name / City
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

    // 7. Prepare recipient emails
    const recipientEmails = [
      'ftshivamtiwari222@gmail.com',
      'Damodara.s@skanray.com'
    ];

    // Add service engineer email
    if (combinedData.userInfo.email && combinedData.userInfo.email !== 'N/A') {
      recipientEmails.push(combinedData.userInfo.email);
    }

    // Add dealer email if exists
    if (combinedData.userInfo.dealerEmail && combinedData.userInfo.dealerEmail !== 'N/A') {
      recipientEmails.push(combinedData.userInfo.dealerEmail);
    }

    // Add manager emails
    if (Array.isArray(combinedData.userInfo.manageremail)) {
      combinedData.userInfo.manageremail.forEach(email => {
        if (email && !recipientEmails.includes(email)) {
          recipientEmails.push(email);
        }
      });
    }

    // 8. Set up mail options
    const mailOptions = {
      from: 'webadmin@skanray-access.com',
      to: recipientEmails.join(','),
      subject: 'New Complaint Request',
      html: emailBodyHtml,
    };

    // 9. Send the email
    await transporter.sendMail(mailOptions);

    // 10. Send success response
    return res.status(200).json({
      message: 'Email sent successfully to all recipients.',
      recipients: recipientEmails,
      combinedData
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
      user, // Complete user object from frontend
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
    let finalPhone = 'N/A';
    let finalEmail = 'N/A';
    let finalpincode = 'N/A';

    if (foundCustomer) {
      finalHospitalName = foundCustomer.hospitalname || name;
      finalCity = foundCustomer.city || city;
      finalPhone = foundCustomer.telephone || 'N/A';
      finalEmail = foundCustomer.email || 'N/A';
      finalpincode = foundCustomer.postalcode || 'N/A';
    }

    // Determine engineer title based on usertype
    const engineerTitle = user?.usertype === 'dealer'
      ? 'Dealer Service Engineer'
      : 'Service Engineer';

    // 4. Build the HTML email with exact design from image
    const emailHTML = `
      <html>
      <head>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            color: #000; 
            margin: 0; 
            padding: 0; 
            background-color: #ffffff;
          }
          .container { 
            background-color: white;
            max-width: 800px; 
            margin: 0; 
            padding: 0;
            border: none;
          }
          .header { 
            background-color: #00ff00; 
            color: black; 
            padding: 3px 8px; 
            font-weight: bold;
            font-size: 12px;
            margin: 0;
          }
          .content { 
            padding: 15px; 
            line-height: 1.6;
            font-size: 14px;
            font-family: Arial, sans-serif;
          }
          .field { 
            margin: 2px 0;
            font-size: 14px;
          }
          .highlight-yellow { 
            background-color: #ffff00; 
            padding: 0px 2px;
            font-weight: bold;
          }
          .highlight-blue { 
            background-color: #0066ff; 
            color: white; 
            padding: 0px 2px;
            font-weight: bold;
          }
          .highlight-green { 
            background-color: #00ff00; 
            color: black; 
            padding: 0px 2px;
            font-weight: bold;
          }
          .highlight-red { 
            background-color: #ff0000; 
            color: white; 
            padding: 0px 2px;
            font-weight: bold;
          }
          .vendor-section {
            background-color: #00ff00;
            color: black;
            padding: 3px 8px;
            margin: 15px 0 0 0;
            font-weight: bold;
            font-size: 12px;
          }
          .greeting {
            margin: 10px 0;
            font-size: 14px;
          }
          .action-section {
            background-color: #00ff00;
            color: black;
            padding: 2px 4px;
            margin: 10px 0;
            font-weight: bold;
            font-size: 14px;
          }
          .strikethrough {
            text-decoration: line-through;
            color: #ff0000;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <div class="greeting"><strong>Dear CIC,</strong></div>
            <div class="greeting">Kindly update the notification as below</div>
            
            <div class="field">
              Notification No: <span class="highlight-yellow">${notification_no}</span>
            </div>
            
            <div class="field">
              Serial no : ${serial_no}
            </div>
            
            <div class="field">
              Description : <span class="highlight-yellow">${description}</span>
            </div>
            
            <div class="field">
              Part no : ${part_no}
            </div>
            
            <div class="field">
              Customer : ${customer} Name : <span class="highlight-yellow">${finalHospitalName}</span>
            </div>
            
            <div class="field">
              City : <span class="highlight-blue">${finalCity}</span>
            </div>
            
            
            
            <div class="field">
              Spare Required : <span class="highlight-red">${spareRequested || 'N/A'}</span>
            </div>
            
            <div class="field">
              Remarks : ${remarks}
            </div>
            
            <div class="field">
              ${engineerTitle} : ${user?.firstName || ''} ${user?.lastName || ''}
            </div>
            
            <div class="field">
              ${engineerTitle} Mobile : ${user?.mobilenumber || serviceEngineerMobile}
            </div>
            
            <div class="field">
              ${engineerTitle} Email : ${user?.email || serviceEngineerEmail}
            </div>
          </div>
          
          <div class="vendor-section">
            Vendor Details ✓ Vendor Code / Vendor Name / City
          </div>
        </div>
      </body>
      </html>
    `;

    // 5. Configure nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'webadmin@skanray-access.com',
        pass: 'rdzegwmzirvbjcpm'
      },
    });

    // 6. Prepare recipient emails
    const recipientEmails = [
      'ftshivamtiwari222@gmail.com',
      'Damodara.s@skanray.com',
      // 'tomson.m+customer@skanray.com'
    ];

    // Add service engineer email
    if (user?.email && user.email !== 'N/A') {
      recipientEmails.push(user.email);
    }

    // Add dealer email if exists
    if (user?.dealerEmail && user.dealerEmail !== 'N/A') {
      recipientEmails.push(user.dealerEmail);
    }

    // Add manager emails
    if (Array.isArray(user?.manageremail)) {
      user.manageremail.forEach(email => {
        if (email && !recipientEmails.includes(email)) {
          recipientEmails.push(email);
        }
      });
    }

    // 7. Set up mail options
    const mailOptions = {
      from: 'webadmin@skanray-access.com',
      to: recipientEmails.join(','),
      subject: 'Update Notification - ' + notification_no,
      html: emailHTML
    };

    // 8. Send the email
    await transporter.sendMail(mailOptions);

    // 9. Return success response
    return res.status(200).json({
      message: 'Updated complaint email sent successfully to all recipients.',
      recipients: recipientEmails,
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
// GET /allpendingcomplaints/:employeeid? - For fetching data with pagination only
router.get('/allpendingcomplaints/:employeeid?', async (req, res) => {
  try {
    const { employeeid } = req.params;

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (employeeid) {
      // 1. Get the user
      const user = await User.findOne({ employeeid });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      let baseFilter = {};
      let filterInfo = {};

      // 2. Check usertype and apply appropriate logic
      if (user.usertype === 'skanray') {
        // SKANRAY USER LOGIC - Based on Branch & Skills
        const partNumbers = [];
        user.skills.forEach(skill => {
          if (skill.partNumbers && skill.partNumbers.length > 0) {
            partNumbers.push(...skill.partNumbers);
          }
        });

        const branchNames = user.branch || [];

        baseFilter = {
          materialcode: { $in: partNumbers },
          salesoffice: { $in: branchNames }
        };

        filterInfo = {
          filteredBy: 'skanray',
          partNumbers,
          branches: branchNames,
          usertype: 'skanray'
        };

      } else if (user.usertype === 'dealer') {
        // DEALER USER LOGIC - Based on Dealer Code only
        const dealerCode = user.dealerInfo?.dealerCode;

        if (!dealerCode) {
          return res.status(400).json({
            message: 'Dealer code not found for this dealer user'
          });
        }

        baseFilter = {
          dealercode: dealerCode
        };

        filterInfo = {
          filteredBy: 'dealer',
          dealerCode,
          usertype: 'dealer'
        };

      } else {
        return res.status(400).json({
          message: 'Invalid user type'
        });
      }

      // Get total count for pagination
      const totalComplaints = await PendingComplaints.countDocuments(baseFilter);
      const totalPages = Math.ceil(totalComplaints / limit);

      // Apply pagination and get results
      const pendingComplaints = await PendingComplaints.find(baseFilter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      return res.json({
        success: true,
        pendingComplaints,
        pagination: {
          currentPage: page,
          totalPages,
          totalComplaints,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        filteredByEmployee: true,
        filterInfo
      });
    }

    // Default: Return all complaints with pagination if no employeeid provided
    const totalComplaints = await PendingComplaints.countDocuments({});
    const totalPages = Math.ceil(totalComplaints / limit);

    const pendingComplaints = await PendingComplaints.find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      pendingComplaints,
      pagination: {
        currentPage: page,
        totalPages,
        totalComplaints,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      filteredByEmployee: false
    });

  } catch (err) {
    console.error('Error in allpendingcomplaints API:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});



// GET /searchpendingcomplaints/:employeeid? - For search functionality
router.get('/searchpendingcomplaints/:employeeid?', async (req, res) => {
  try {
    const { employeeid } = req.params;

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Search parameters
    const searchQuery = req.query.search || '';

    if (!searchQuery.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    let baseFilter = {};
    let filterInfo = {};

    if (employeeid) {
      // 1. Get the user
      const user = await User.findOne({ employeeid });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // 2. Apply user-type specific base filters first
      if (user.usertype === 'skanray') {
        const partNumbers = [];
        user.skills.forEach(skill => {
          if (skill.partNumbers && skill.partNumbers.length > 0) {
            partNumbers.push(...skill.partNumbers);
          }
        });

        const branchNames = user.branch || [];

        // Base filter for skanray user
        baseFilter = {
          materialcode: { $in: partNumbers },
          salesoffice: { $in: branchNames }
        };

        filterInfo = {
          filteredBy: 'skanray',
          partNumbers,
          branches: branchNames,
          usertype: 'skanray'
        };

      } else if (user.usertype === 'dealer') {
        const dealerCode = user.dealerInfo?.dealerCode;

        if (!dealerCode) {
          return res.status(400).json({
            message: 'Dealer code not found for this dealer user'
          });
        }

        // Base filter for dealer user
        baseFilter = {
          dealercode: dealerCode
        };

        filterInfo = {
          filteredBy: 'dealer',
          dealerCode,
          usertype: 'dealer'
        };
      }
    }

    // Add search functionality on top of base filter
    const searchConditions = [
      { materialcode: { $regex: searchQuery, $options: 'i' } },
      { dealercode: { $regex: searchQuery, $options: 'i' } },
      { salesoffice: { $regex: searchQuery, $options: 'i' } },
      { notification_complaintid: { $regex: searchQuery, $options: 'i' } },
      { serialnumber: { $regex: searchQuery, $options: 'i' } },
      { materialdescription: { $regex: searchQuery, $options: 'i' } },
      { reportedproblem: { $regex: searchQuery, $options: 'i' } },
      { customercode: { $regex: searchQuery, $options: 'i' } },
      { productgroup: { $regex: searchQuery, $options: 'i' } },
      { status: { $regex: searchQuery, $options: 'i' } },
      { notificationtype: { $regex: searchQuery, $options: 'i' } },
      { userstatus: { $regex: searchQuery, $options: 'i' } },
      { devicedata: { $regex: searchQuery, $options: 'i' } },
      { partnerresp: { $regex: searchQuery, $options: 'i' } },
      { breakdown: { $regex: searchQuery, $options: 'i' } },
      { problemtype: { $regex: searchQuery, $options: 'i' } },
      { problemname: { $regex: searchQuery, $options: 'i' } },
      { sparerequest: { $regex: searchQuery, $options: 'i' } },
      { remark: { $regex: searchQuery, $options: 'i' } }
    ];

    // Combine base filter with search conditions
    if (Object.keys(baseFilter).length > 0) {
      // If there's a base filter (user-specific), combine with AND condition
      baseFilter = {
        $and: [
          baseFilter,
          { $or: searchConditions }
        ]
      };
    } else {
      // If no base filter, use only search conditions
      baseFilter = { $or: searchConditions };
    }

    // Get total count for pagination
    const totalComplaints = await PendingComplaints.countDocuments(baseFilter);
    const totalPages = Math.ceil(totalComplaints / limit);

    // Apply pagination and get results
    const pendingComplaints = await PendingComplaints.find(baseFilter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      pendingComplaints,
      pagination: {
        currentPage: page,
        totalPages,
        totalComplaints,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      filteredByEmployee: !!employeeid,
      filterInfo,
      searchQuery,
      searchableFields: [
        'materialcode', 'dealercode', 'salesoffice', 'notification_complaintid',
        'serialnumber', 'materialdescription', 'reportedproblem', 'customercode',
        'productgroup', 'status', 'notificationtype', 'userstatus', 'devicedata',
        'partnerresp', 'breakdown', 'problemtype', 'problemname', 'sparerequest', 'remark'
      ]
    });

  } catch (err) {
    console.error('Error in searchpendingcomplaints API:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!q) {
      return res.status(400).json({ message: 'query parameter is required' });
    }

    const query = {
      $or: [
        { notificationtype: { $regex: q, $options: 'i' } },
        { notification_complaintid: { $regex: q, $options: 'i' } },
        { notificationdate: { $regex: q, $options: 'i' } },
        { userstatus: { $regex: q, $options: 'i' } },
        { materialdescription: { $regex: q, $options: 'i' } },
        { serialnumber: { $regex: q, $options: 'i' } },
        { devicedata: { $regex: q, $options: 'i' } },
        { salesoffice: { $regex: q, $options: 'i' } },
        { materialcode: { $regex: q, $options: 'i' } },
        { reportedproblem: { $regex: q, $options: 'i' } },
        { dealercode: { $regex: q, $options: 'i' } },
        { customercode: { $regex: q, $options: 'i' } },
        { partnerresp: { $regex: q, $options: 'i' } },
        { sparerequest: { $regex: q, $options: 'i' } },
        { remark: { $regex: q, $options: 'i' } },
        { breakdown: { $regex: q, $options: 'i' } },
        { status: { $regex: q, $options: 'i' } }
      ]
    };

    const pendingComplaints = await PendingComplaints.find(query).skip(skip).limit(limit);
    const totalPendingComplaints = await PendingComplaints.countDocuments(query);
    const totalPages = Math.ceil(totalPendingComplaints / limit);

    res.json({
      pendingComplaints,
      totalPages,
      totalPendingComplaints,
      currentPage: page,
      isSearch: true
    });

  } catch (err) {
    res.status(500).json({
      message: err.message,
      pendingComplaints: [],
      totalPages: 1,
      totalPendingComplaints: 0,
      currentPage: 1
    });
  }
});




router.post("/sendOtpEmail", async (req, res) => {
  try {
    const {
      customerEmail,
      serviceCallNo,
      unitSerialNo,
      productDescription,
      problemReported,
      actionTaken,
      customerDetails
    } = req.body;

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

    // Create email template matching your image design
    const emailHTML = `
      <html>
      <head>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            color: #000; 
            margin: 20px; 
            font-size: 14px;
            line-height: 1.6;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
          }
          .field {
            margin: 5px 0;
          }
          .otp-highlight {
            background-color: #ffff00;
            padding: 2px 4px;
            font-weight: bold;
            display: inline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <p><strong>Dear Customer,</strong></p>
          
          <p>Below service complaint is attended by our service team and being closed</p>
          
          <div class="field">
            <strong>Service Call No:</strong> ${serviceCallNo || 'N/A'}
          </div>
          
          <div class="field">
            <strong>Unit Serial no:</strong> ${unitSerialNo || 'N/A'}
          </div>
          
          <div class="field">
            <strong>Product Description:</strong> ${productDescription || 'N/A'}
          </div>
          
          <div class="field">
            <strong>Problem Reported:</strong> ${problemReported || 'N/A'}
          </div>
          
          <div class="field">
            <strong>Action Taken:</strong> ${actionTaken || 'N/A'}
          </div>
          
          <p>
            Kindly provide the acceptance token ID <span class="otp-highlight">(${generatedOtp})</span> to the service team acknowledging to close the service call after being satisfied. You will receive a digitally signed Service report in your email
          </p>
          
          <p><strong>Regards</strong></p>
          
          <p>Skanray Service Support team</p>
        </div>
      </body>
      </html>
    `;

    // Send the OTP via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: 'webadmin@skanray-access.com',
        pass: 'rdzegwmzirvbjcpm'
      }
    });

    const mailOptions = {
      from: "webadmin@skanray-access.com",
      to: customerEmail,
      subject: `Service Completion OTP - ${serviceCallNo || 'Service Request'}`,
      html: emailHTML,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: "OTP sent successfully to customer email.",
      email: customerEmail,
      serviceCallNo: serviceCallNo,
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
      sparesReplaced = [],
      customerCode,
      userInfo,
      injuryDetails,
      customerDetails,
      description,
      partNumber,
      partDescription,
      customerRemarks,
      customerAdditionalRemarks,
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
    const dateAttended = new Date().toLocaleDateString("en-GB");
    const currentDate = new Date().toLocaleDateString("en-GB");

    // Determine engineer title based on usertype
    const engineerTitle = userInfo?.usertype === 'dealer'
      ? 'Dealer Service Engineer'
      : 'Service Engineer';

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

    // Spares replaced display for email
    let sparesDisplayHTML = "";
    if (sparesReplaced.length > 0) {
      sparesDisplayHTML = `
        <div style="margin: 10px 0; background-color: #00ff00; padding: 2px;">
          <div style="margin: 2px 0;">Spares Replaced : Yes</div>
      `;
      sparesReplaced.forEach((spare, index) => {
        sparesDisplayHTML += `
          <div style="margin: 2px 0;">${index + 1}. ${spare.Description || 'ABCD'}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Def: ${spare.defectivePartNumber || '123'}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="background-color: #00ff00;">Good: ${spare.replacedPartNumber || '123'}</span></div>
        `;
      });
      sparesDisplayHTML += `</div>`;
    } else {
      sparesDisplayHTML = `<div class="field">Spares Replaced : No</div>`;
    }

    function formatExcelDate(serial) {
      if (!serial || isNaN(serial)) return "";
      const excelEpoch = new Date(1899, 11, 30);
      const days = Math.floor(serial);
      const milliseconds = (serial - days) * 24 * 60 * 60 * 1000;
      const date = new Date(excelEpoch.getTime() + days * 86400000 + milliseconds);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }

    // 4) Build the Service Engineers Email Template (First Image Design)
    const serviceEngineersEmailHTML = `
      <html>
      <head>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            color: #000; 
            margin: 0; 
            padding: 0; 
            background-color: #ffffff;
          }
          .container { 
            background-color: white;
            max-width: 800px; 
            margin: 0; 
            padding: 0;
            border: none;
          }
          .header { 
            background-color: #00ff00; 
            color: black; 
            padding: 3px 8px; 
            font-weight: bold;
            font-size: 12px;
            margin: 0;
          }
          .content { 
            padding: 15px; 
            line-height: 1.6;
            font-size: 14px;
            font-family: Arial, sans-serif;
          }
          .field { 
            margin: 2px 0;
            font-size: 14px;
          }
          .highlight-yellow { 
            background-color: #ffff00; 
            padding: 0px 2px;
            font-weight: bold;
          }
          .highlight-blue { 
            background-color: #0066ff; 
            color: white; 
            padding: 0px 2px;
            font-weight: bold;
          }
          .highlight-green { 
            background-color: #00ff00; 
            color: black; 
            padding: 0px 2px;
            font-weight: bold;
          }
          .vendor-section {
            background-color: #00ff00;
            color: black;
            padding: 3px 8px;
            margin: 15px 0 0 0;
            font-weight: bold;
            font-size: 12px;
          }
          .greeting {
            margin: 10px 0;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
           
          <div class="content">
            <div class="greeting"><strong>Dear CIC,</strong></div>
            <div class="greeting">Kindly Close the notification as below</div>
            
            <div class="field">
              Notification No: <span class="highlight-yellow">${complaintNumber}</span>
            </div>
            
            <div class="field">
              Serial no : ${serialNumber}
            </div>
            
            <div class="field">
              Description : <span class="highlight-yellow">${description}</span>
            </div>
            
            <div class="field">
              Name : ${customerDetails?.hospitalName || customerDetails?.customername || 'N/A'}
            </div>
            
            <div class="field">
              City : <span class="highlight-blue">${customerDetails?.city || 'N/A'}</span>
            </div>
            
            <div class="field">
              Problem Reported : <span class="highlight-green">${reportedProblem}</span>
            </div>
            
            <div style="background-color: #00ff00; padding: 3px 8px; margin: 10px 0; font-weight: bold;">
              Action Taken : ${actionTaken}
            </div>
            
            <div class="field">
              Remarks : ${instructionToCustomer || 'Complaint resolved successfully'}
            </div>
            
            ${sparesDisplayHTML}
            
            <div class="field">
              ${engineerTitle} : <span style="background-color: #00ff00; padding: 0px 2px;">${userInfo?.firstName || ''} ${userInfo?.lastName || ''}</span>
            </div>
            
            <div class="field">
              ${engineerTitle} Mobile : ${userInfo?.mobilenumber || 'N/A'}
            </div>
            
            <div class="field">
              ${engineerTitle} Email : ${userInfo?.email || 'N/A'}
            </div>
          </div>
          
          <div class="vendor-section">
            Vendor Details ✓ Vendor Code / Vendor Name / City
          </div>
        </div>
      </body>
      </html>
    `;

    // 5) Build the Customer Email Template (Second Image Design)
    const customerEmailHTML = `
      <html>
      <head>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            color: #000; 
            margin: 0; 
            padding: 0; 
            background-color: #ffffff;
          }
          .container { 
            background-color: white;
            max-width: 800px; 
            margin: 0; 
            padding: 0;
            border: none;
          }
          .header { 
            background-color: #00ff00; 
            color: black; 
            padding: 3px 8px; 
            font-weight: bold;
            font-size: 12px;
            margin: 0;
          }
          .content { 
            padding: 15px; 
            line-height: 1.6;
            font-size: 14px;
            font-family: Arial, sans-serif;
          }
          .greeting {
            margin: 10px 0;
            font-size: 14px;
          }
          .info-section {
            background-color: #00ff00;
            padding: 5px;
            margin: 10px 0;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <div class="greeting"><strong>Dear Customer,</strong></div>
            
            <div class="info-section">
              The Service request no : (${complaintNumber}) for ( ${description} / ${serialNumber} ) is successfully closed up on your Digital authentication by providing OTP.
            </div>
            
            <div class="info-section">
              Please find the service report ( Digitally Signed by Skanray )!
            </div>
            
            <div class="greeting">
              In case of any queries kindly email to :CIC@skanray.com
            </div>
            
            <div class="info-section">
              You can also call our Toll Free No :1800 425 7002  / 0821 2402005
            </div>
       
            <div style="margin-top: 20px;">
              <p>Best Regards,<br>Skanray Technologies Limited</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // 6) Build the Service Report HTML with compact styling (for PDF)
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
          <td style="width: 16%;">Notification Date:</td>
          <td style="width: 17%;">${notificationDate}</td>
          <td style="width: 17%;">Service Type:</td>
          <td style="width: 17%;">${notificationType || "N/A"}</td>
        </tr>
      </table>

      <!-- 3) Customer Details + Part Details -->
      <table>
        <tr>
          <td style="width: 50%;">
            <strong>Customer Code:</strong> ${customerCode || "N/A"}<br/>
            <strong>Name:</strong> ${customerDetails?.customername || "N/A"}<br/>
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
            <strong>${engineerTitle} Name:</strong><br/>
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
              Digitally Authorised by ${customerDetails?.hospitalName || customerDetails?.customername || "N/A"}
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
            <div style="border-bottom: 1px solid black; padding-left: 5px;">
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

    // 7) Set PDF file name
    const pdfFileName = `${complaintNumber || "report"}_${(description || "description").replace(/\s+/g, "_")}.pdf`;

    // 8) Generate PDF with adjusted settings
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
        // 9) Configure nodemailer transporter
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: 'webadmin@skanray-access.com',
            pass: 'rdzegwmzirvbjcpm'
          }
        });

        // 10) Prepare recipient emails for SERVICE ENGINEERS
        const serviceEngineerEmails = [
          'ftshivamtiwari222@gmail.com',
          'Damodara.s@skanray.com'
        ];

        // Add service engineer email
        if (userInfo?.email && userInfo.email !== 'N/A') {
          serviceEngineerEmails.push(userInfo.email);
        }

        // Add dealer email if exists
        if (userInfo?.dealerEmail && userInfo.dealerEmail !== 'N/A') {
          serviceEngineerEmails.push(userInfo.dealerEmail);
        }

        // Add manager emails
        if (Array.isArray(userInfo?.manageremail)) {
          userInfo.manageremail.forEach(email => {
            if (email && !serviceEngineerEmails.includes(email)) {
              serviceEngineerEmails.push(email);
            }
          });
        }

        // 11) Send email to SERVICE ENGINEERS (First Template)
        const serviceEngineerMailOptions = {
          from: "webadmin@skanray-access.com",
          to: serviceEngineerEmails.join(','),
          subject: 'Close Notification - ' + complaintNumber,
          html: serviceEngineersEmailHTML,
          attachments: [
            {
              filename: pdfFileName,
              content: pdfBuffer,
              contentType: 'application/pdf'
            },
          ],
        };

        await transporter.sendMail(serviceEngineerMailOptions);

        // 12) Send email to CUSTOMER (Second Template with PDF)
        if (customerEmail) {
          const customerMailOptions = {
            from: "webadmin@skanray-access.com",
            to: customerEmail,
            subject: 'Service Request Closure - ' + complaintNumber,
            html: customerEmailHTML,
            attachments: [
              {
                filename: pdfFileName,
                content: pdfBuffer,
                contentType: 'application/pdf'
              },
            ],
          };

          await transporter.sendMail(customerMailOptions);
        }

        // 13) DELETE the pending complaint after successful email send
        let deletedComplaint = null;
        let deletionError = null;

        try {
          deletedComplaint = await PendingComplaints.findOneAndDelete({
            notification_complaintid: complaintNumber
          });

          if (deletedComplaint) {
            console.log(`Successfully deleted pending complaint: ${complaintNumber}`);
          } else {
            console.log(`No pending complaint found with ID: ${complaintNumber}`);
          }
        } catch (deleteErr) {
          console.error("Error deleting pending complaint:", deleteErr);
          deletionError = deleteErr.message;
        }

        return res.status(200).json({
          message: "OTP verified, emails sent successfully!",
          complaintClosed: true,
          serviceEngineerRecipients: serviceEngineerEmails,
          customerEmail: customerEmail,
          pendingComplaintDeleted: deletedComplaint ? true : false,
          deletionError: deletionError,
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
