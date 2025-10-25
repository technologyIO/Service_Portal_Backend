const mongoose = require('mongoose');

const GstSchema = new mongoose.Schema({
    gst: {
        type: String,
        required: true,
        unique: true
    },
    role: {
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
});

module.exports = mongoose.model('Gst', GstSchema);
