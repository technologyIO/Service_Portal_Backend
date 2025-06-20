const mongoose = require('mongoose');

const CmcNcmcPriceSchema = new mongoose.Schema({
    partNumber: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    product: {
        type: String,
        required: true
    },
    cmcPriceWithGst: {
        type: Number,
        required: true
    },
    ncmcPriceWithGst: {
        type: Number,
        required: true
    },
    serviceTax: {
        type: String,
    },
    remarks: {
        type: String,
        default: ''
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

module.exports = mongoose.model('CmcNcmcPrice', CmcNcmcPriceSchema);
