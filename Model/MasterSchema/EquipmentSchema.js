const mongoose = require('mongoose');

const EquipmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    materialdescription: {
        type: String,
        required: true
    },
    serialnumber : {
        type: String,
        required: true,
        unique: true // Ensure serial number uniqueness
    },
    materialcode: {
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
    currentcustomer: {
        type: String,
        required: true
    },
    endcustomer: {
        type: Date,
        required: true
    },
    equipmentid: {
        type: String,
        required: true,
        unique: true // Ensure equipment ID uniqueness
    },
    custWarrantystartdate: {
        type: String,
        required: true
    },
    custWarrantyenddate: {
        type: String,
        required: true
    },
    dealerwarrantystartdate: {
        type: String,
        required: true
    },
    dealerwarrantyenddate: {
        type: String,
        required: true
    },
    dealer: {
        type: String,
        required: true
    },
    palnumber: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Equipment', EquipmentSchema);
