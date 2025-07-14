const mongoose = require("mongoose");

const PendingComplaintsSchema = new mongoose.Schema({
  notificationtype: {
    type: String
  },
  notification_complaintid: {
    type: String
  },
  notificationdate: {
    type: String
  },
  userstatus: {
    type: String
  },
  materialdescription: {
    type: String
  },
  serialnumber: {
    type: String
  },
  devicedata: {
    type: String
  },
  salesoffice: {
    type: String
  },
  materialcode: {
    type: String
  },
  reportedproblem: {
    type: String
  },
  dealercode: {
    type: String
  },
  customercode: {
    type: String
  },
  partnerresp: {
    type: String
  },
  breakdown: {
    type: Boolean
  },
  status: {
    type: String
  },
  productgroup: {
    type: String
  },
  /** NEW or existing fields to handle "Problem Type," "Problem Name," etc. */
  problemtype: {
    type: String
  },
  problemname: {
    type: String
  },
  /** For "Spares Required": */
  sparerequest: {
    type: String
  },
  /** For "Remarks": */
  remark: {
    type: String
  },
  /** You already have: sets or toggles in code if you like */
  requesteupdate: {
    type: Boolean,
    default: false
  },
  rev: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  modifiedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("PendingComplaints", PendingComplaintsSchema);
