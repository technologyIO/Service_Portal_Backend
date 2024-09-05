const mongoose = require('mongoose');

const PmMasterSchema = new mongoose.Schema({
    pmtype: {
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
    pmumber: {
        type: String,
        required: true
    },
    documentnumber: {
        type: String,
        required: true
    },
    materialdescription: {
        type: String,
        required: true
    },
    serialnumber: {
        type: String,
        required: true
    },
    customercode: {
        type: String,
        required: true
    },
    region: {
        type: String,
        required: true
    },
    pmduemonth: {
        type: String,
        required: true
    },
    pmdonedate: {
        type: String,
        required: true
    },
    pmvendorcode: {
        type: String,
        required: true
    },
    pmengineercode: {
        type: String,
        required: true
    },
    pmstatus: {
        type: String,
        enum: ['Comp', 'Due', 'Overdue', 'Lapse'],
        required: true
    },
    assignedto: {
        type: String,
        required: true
    },
    assignedby: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
});

module.exports = mongoose.model('PmMaster', PmMasterSchema);
