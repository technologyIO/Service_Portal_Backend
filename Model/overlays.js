const mongoose = require('mongoose');

const OverlaySchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['text', 'logo']
    },
    content: {
        type: String,
        required: true,
        maxlength: 10 * 1024 * 1024  
    },
    position: {
        x: {
            type: Number,
            required: true
        },
        y: {
            type: Number,
            required: true
        }
    },
    size: {
        type: Number,
        required: true
    },
    videoUrl: {
        type: String,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Overlay', OverlaySchema);