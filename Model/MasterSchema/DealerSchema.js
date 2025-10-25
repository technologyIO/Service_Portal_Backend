const mongoose = require('mongoose');

const DealerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    personresponsible: [{
        name: { type: String, required: true },
        employeeid: { type: String, required: true }
    }],
    email: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        default: 'Active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    modifiedAt: {
        type: Date,
        default: Date.now
    },
    dealercode: {
        type: String,
        required: true,
        unique: true
    },
    state: {
        type: [String], // Array of state names (multi-select)
        required: true
    },
    city: {
        type: [String], // Array of city names (multi-select)
        required: true
    },
    address: {
        type: String,
        required: true
    },
    pincode: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Dealer', DealerSchema);
