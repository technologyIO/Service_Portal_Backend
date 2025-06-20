const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
    name: {
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
    branchShortCode: {
        type: String,
        required: true
    },
    region: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Branch', BranchSchema);
