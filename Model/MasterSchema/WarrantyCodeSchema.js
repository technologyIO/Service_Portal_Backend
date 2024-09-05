const mongoose = require('mongoose');

const WarrantyCodeSchema = new mongoose.Schema({
    warrantycodeid: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    months: {
        type: Number,
        required: true
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

module.exports = mongoose.model('WarrantyCode', WarrantyCodeSchema);
