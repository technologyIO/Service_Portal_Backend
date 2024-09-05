const mongoose = require('mongoose');

const StateSchema = new mongoose.Schema({
    name: {
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
    },
    country: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('State', StateSchema);
