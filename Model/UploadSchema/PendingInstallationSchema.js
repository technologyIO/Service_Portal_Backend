const mongoose = require("mongoose");

const PendingInstallationSchema = new mongoose.Schema({
    invoiceno: {
        type: String,
        required: true
    },
    invoicedate: { type: Date, required: true },
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

    },
    customername2: {
        type: String,

    },
    customercity: {
        type: String,

    },
    customerpostalcode: {
        type: String,

    },
    material: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    serialnumber: {
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

    },
    customerregion: {
        type: String,

    },
    currentcustomerid: {
        type: String,
        required: true
    },
    currentcustomername1: {
        type: String,

    },
    currentcustomername2: {
        type: String,

    },
    currentcustomercity: {
        type: String,

    },
    currentcustomerregion: {
        type: String,

    },
    currentcustomerpostalcode: {
        type: String,

    },
    currentcustomercountry: {
        type: String,

    },
    mtl_grp4: {
        type: String,
        required: true
    },
    key: {
        type: String,

    },
    palnumber: {
        type: String,
    },
    status: {
        type: String,
        default: 'Active',
    }
    ,
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
