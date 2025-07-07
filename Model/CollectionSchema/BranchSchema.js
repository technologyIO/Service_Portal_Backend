const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
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
    },
    state: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Branch', BranchSchema);
