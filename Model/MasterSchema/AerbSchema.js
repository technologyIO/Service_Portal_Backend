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
AerbSchema.pre('save', function (next) {
    this.modifiedAt = new Date();
    next();
});

// Update modifiedAt before findOneAndUpdate
AerbSchema.pre('findOneAndUpdate', function (next) {
    this.set({ modifiedAt: new Date() });
    next();
});

module.exports = mongoose.model("Aerb", AerbSchema);