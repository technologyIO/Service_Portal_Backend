const mongoose = require("mongoose")

const HubStockSchema = new mongoose.Schema({
    materialcode: {
        type: String,
        required: true
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
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model("HubStock", HubStockSchema);