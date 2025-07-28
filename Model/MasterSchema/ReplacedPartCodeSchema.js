// Add this to your ReplacedPartCodeSchema.js file
const mongoose = require('mongoose');

const ReplacedPartCodeSchema = new mongoose.Schema({
    catalog: {
        type: String,
        required: true
    },
    codegroup: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    code: {
        type: String,
        required: true
    },
    shorttextforcode: {
        type: String,
        required: true,
    },
    slno: {
        type: String,
        required: true,
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

// Add compound index for better performance
ReplacedPartCodeSchema.index({ catalog: 1, codegroup: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("ReplacedPartCode", ReplacedPartCodeSchema);
