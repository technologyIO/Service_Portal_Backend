const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema({
    customercodeid: {
        type: String,
        required: true,
        unique: true  // Only customercodeid is unique
    },
    customername: {
        type: String,
    },
    hospitalname: {
        type: String,
        required: true
    },
    street: {
        type: String,
    },
    city: {
        type: String,
    },
    postalcode: {
        type: String,
    },
    district: {
        type: String,
    },
    state: {
        type: String,
    },
    region: {
        type: String,
    },
    country: {
        type: String,
    },
    telephone: {
        type: String,
    },
    taxnumber1: {
        type: String,
    },
    taxnumber2: {
        type: String,
    },
    email: {
        type: String,
        required: true,
    },
    status: {
        type: String,
    },
    customertype: {
        type: String,
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