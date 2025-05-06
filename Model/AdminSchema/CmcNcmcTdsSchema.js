const mongoose = require('mongoose');

const CmcNcmcTdsSchema = new mongoose.Schema({
    tds: {
        type: String,
        required: true
    },
    role: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
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

module.exports = mongoose.model('CmcNcmcTds', CmcNcmcTdsSchema);
