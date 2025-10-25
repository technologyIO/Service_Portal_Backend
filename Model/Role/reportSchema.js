// models/Component.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
   reportId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);
