const mongoose = require('mongoose');

const DealerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    personresponsible: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true // Ensure email uniqueness
    },
    mobilenumber: {
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
    },
    branch: {
        type: String,
        required: true
    },
    loginexpirydate: {
        type: Date,
        required: true
    },
    dealerid: {
        type: String,
        required: true,
        unique: true // Ensure dealer ID uniqueness
    },
    country: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    region: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    pincode: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    manageremail: {
        type: String,
        required: true
    },
    skills: {
        type: String,
        required: true
    },
    profileimage: {
        type: String,
        required: true
    },
    deviceid: {
        type: String,
        required: true
    },
    deviceregistereddate: {
        type: Date,
        default: Date.now
    },
});

module.exports = mongoose.model('Dealer', DealerSchema);
