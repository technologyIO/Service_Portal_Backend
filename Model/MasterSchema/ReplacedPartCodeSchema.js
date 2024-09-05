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
        required: true
    },
    slno: {
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
    }
});

module.exports = mongoose.model("ReplacedPartCode", ReplacedPartCodeSchema);
