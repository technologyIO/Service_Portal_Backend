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
        enum: ['Active', 'Pending', 'Inactive'], // optional: restrict values
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
})

module.exports = mongoose.model("Aerb", AerbSchema);