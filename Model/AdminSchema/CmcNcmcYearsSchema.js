const mongoose = require('mongoose');

const cmcNcmcYearSchema = new mongoose.Schema({
    year: {
        type: Number,
        required: true,
        unique: true
    },
    status: {
        type: String,
        required: true,
        enum: ['Active', 'Inactive']
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

module.exports = mongoose.model('CmcNcmcYear', cmcNcmcYearSchema);
