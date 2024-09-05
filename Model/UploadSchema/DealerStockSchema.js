const mongoose = require("mongoose");

const DealerStockSchema = new mongoose.Schema({
    dealercodeid: {
        type: String,
        required: true
    },
    dealername: {
        type: String,
        required: true
    },
    dealercity: {
        type: String,
        required: true
    },
    materialcode: {
        type: String,
        required: true
    },
    materialdescription: {
        type: String,
        required: true
    },
    plant: {
        type: String,
        required: true
    },
    unrestrictedquantity: {
        type: Number,
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

module.exports = mongoose.model("DealerStock", DealerStockSchema);
