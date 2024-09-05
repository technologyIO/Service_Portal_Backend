const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema({
    customercodeid: {
        type: String,
        required: true,
        unique: true
    },
    customername: {
        type: String,
        required: true
    },
    hospitalname: {
        type: String,
        required: true
    },
    street: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    postalcode: {
        type: String,
        required: true
    },
    district: {
        type: String,
        required: true
    },
    region: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    telephone: {
        type: String,
        required: true
    },
    taxnumber1: {
        type: String,
        required: true
    },
    taxnumber2: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        required: true
    },
    customertype: {
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

module.exports = mongoose.model("Customer", CustomerSchema);
