const mongoose = require('mongoose');

const ProductGroupSchema = new mongoose.Schema({
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
    shortcode: {
        type: String,
        required: true
    },
    ChlNo: {
        type: String,
        required: true

    },
    RevNo: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },

});

module.exports = mongoose.model('ProductGroup', ProductGroupSchema);
