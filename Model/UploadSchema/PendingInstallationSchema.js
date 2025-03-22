const mongoose = require("mongoose");

const PendingInstallationSchema = new mongoose.Schema({
    invoiceno: {
        type: String,
        required: true
    },
    invoicedate: {
        type: String,
        required: true
    },
    distchnl: {
        type: String,
        required: true
    },
    customerid: {
        type: String,
        required: true
    },
    customername1: {
        type: String,
        required: true
    },
    customername2: {
        type: String,
        required: true
    },
    customercity: {
        type: String,
        required: true
    },
    customerpostalcode: {
        type: String,
        required: true
    },
    material: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    serialnumber : {
        type: String,
        required: true,
        unique: true
    },
    salesdist: {
        type: String,
        required: true
    },
    salesoff: {
        type: String,
        required: true
    },
    customercountry: {
        type: String,
        required: true
    },
    customerregion: {
        type: String,
        required: true
    },
    currentcustomerid: {
        type: String,
        required: true
    },
    currentcustomername1: {
        type: String,
        required: true
    },
    currentcustomername2: {
        type: String,
        required: true
    },
    currentcustomercity: {
        type: String,
        required: true
    },
    currentcustomerregion: {
        type: String,
        required: true
    },
    currentcustomerpostalcode: {
        type: String,
        required: true
    },
    currentcustomercountry: {
        type: String,
        required: true
    },
    mtl_grp4: {
        type: String,
        required: true
    },
    key: {
        type: String,
        required: true
    },
    palnumber: {
        type: String,
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

module.exports = mongoose.model("PendingInstallation", PendingInstallationSchema);
