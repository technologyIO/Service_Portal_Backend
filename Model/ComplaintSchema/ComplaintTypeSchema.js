const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        default: "Active",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    modifiedAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('ComplaintType', complaintSchema);
