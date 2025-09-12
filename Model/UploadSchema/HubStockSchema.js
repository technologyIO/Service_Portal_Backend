const mongoose = require("mongoose");

const HubStockSchema = new mongoose.Schema({
    materialcode: {
        type: String,
    },
    materialdescription: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    storagelocation: {
        type: String,
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
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// ✅ Pre-save middleware to update modifiedAt
HubStockSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model("HubStock", HubStockSchema);
