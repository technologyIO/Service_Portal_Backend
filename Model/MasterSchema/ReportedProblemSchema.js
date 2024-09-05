const mongoose = require('mongoose');

const ReportedProblemSchema = new mongoose.Schema({
    catalog: {
        type: String,
        required: true
    },
    codegroup: {
        type: String,
        required: true
    },
    prodgroup: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    shorttextforcode: {
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
    status: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('ReportedProblem', ReportedProblemSchema);
