const mongoose = require('mongoose');

const CmcNcmcTdsSchema = new mongoose.Schema({
    tds: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true
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
    }
});

module.exports = mongoose.model('CmcNcmcTds', CmcNcmcTdsSchema);
