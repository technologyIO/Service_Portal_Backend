const mongoose = require('mongoose')


const ProblemNameSchema = new mongoose.Schema({

    name: {
        type: String
    },
    status: {
        type: String,
        default: "Inactive"
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

module.exports = mongoose.model('problemname', ProblemNameSchema)