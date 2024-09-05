const mongoose = require("mongoose")

const AerbSchema = new mongoose.Schema({
    materialcode: {
        type: String,
        required: true,
        unique: true
    },
    materialdescription: {
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
})

module.exports = mongoose.model("Aerb", AerbSchema);