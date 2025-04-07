const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const PendingComplaints = require("../../Model/UploadSchema/PendingCompliantsSchema"); // Mongoose model

// Multer memory storage ka istemal
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// POST /bulk-upload
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // 1. Pehle existing PendingComplaints records ko delete karo
    const totalExisting = await PendingComplaints.countDocuments();
    let deletedCount = 0;
    if (totalExisting > 0) {
      const docs = await PendingComplaints.find({}, { _id: 1 });
      for (const doc of docs) {
        await PendingComplaints.deleteOne({ _id: doc._id });
        deletedCount++;
      }
    }
    const deletionProgress = totalExisting === 0 ? 100 : Math.round((deletedCount / totalExisting) * 100);

    // 2. Excel file ko parse karke naye PendingComplaints records insert karo
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    const totalRecords = jsonData.length;
    let processed = 0;
    const insertionResults = [];

    for (const record of jsonData) {
      try {
        const newComplaint = new PendingComplaints({
          notificationtype: record.notificationtype,
          notification_complaintid: record.notification_complaintid,
          notificationdate: record.notificationdate,
          userstatus: record.userstatus,
          materialdescription: record.materialdescription,
          serialnumber: record.serialnumber,
          devicedata: record.devicedata,
          salesoffice: record.salesoffice,
          materialcode: record.materialcode,
          reportedproblem: record.reportedproblem,
          dealercode: record.dealercode,
          customercode: record.customercode,
          partnerresp: record.partnerresp,
          breakdown: record.breakdown,
          status: record.status,
          productgroup: record.productgroup,
          problemtype: record.problemtype,
          problemname: record.problemname,
          sparerequest: record.sparerequest,
          remark: record.remark,
          requesteupdate: record.requesteupdate
        });
        await newComplaint.save();
        insertionResults.push({ notification_complaintid: record.notification_complaintid, status: "Created" });
      } catch (error) {
        insertionResults.push({ notification_complaintid: record.notification_complaintid, status: "Failed", error: error.message });
      }
      processed++;
    }

    return res.status(200).json({
      deletion: {
        totalExisting,
        deleted: deletedCount,
        progress: deletionProgress
      },
      insertion: {
        total: totalRecords,
        processed,
        results: insertionResults
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
