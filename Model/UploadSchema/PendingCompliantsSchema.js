const mongoose = require("mongoose");

const PendingComplaintsSchema = new mongoose.Schema({
    notificationtype: {
        type: String,
        required: true
    },
    notification_complaintid: {
        type: String,
        required: true
    },
    notificationdate: {
        type: String,
        required: true
    },
    userstatus: {
        type: String,
        required: true
    },
    materialdescription: {
        type: String,
        required: true
    },
    serialnumber: {
        type: String,
        required: true
    },
    devicedata: {
        type: String,
        required: true
    },
    salesoffice: {
        type: String,
        required: true
    },
    materialcode: {
        type: String,
        required: true
    },
    reportedproblem: {
        type: String,
        required: true
    },
    dealercode: {
        type: String,
        required: true
    },
    customercode: {
        type: String,
        required: true
    },
    partnerresp: {
        type: String,
        required: true
    },
    breakdown: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true
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
