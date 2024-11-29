const mongoose = require('mongoose')

const complaintSchema = new mongoose.Schema({
    name: {
        type: String

    },
    status: {
        type: Boolean

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

module.exports = mongoose.model('complainttype', complaintSchema);