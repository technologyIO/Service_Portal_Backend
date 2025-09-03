const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true, // Only name must be unique
    },
    state: {
        type: String,
        required: true,
    },
    district: {
        type: String
    },
    region: {
        type: String
    },
    country: {
        type: String
    },
    status: {
        type: String,
        default: "Active"
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    modifiedAt: {
        type: Date,
        default: Date.now
    },
    branchShortCode: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Branch', BranchSchema);
