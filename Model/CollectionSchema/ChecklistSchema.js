const mongoose = require('mongoose');

const CheckListSchema = new mongoose.Schema({
    checklisttype: {
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
    checkpointtype: {
        type: String,
        required: true
    },
    checkpoint: {
        type: String,
        required: true
    },
    prodGroup: {
        type: String,
        required: true
    },
    result: {
        type: String,
        required: true
    },
    resulttype: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('CheckList', CheckListSchema);
