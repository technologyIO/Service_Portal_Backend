const mongoose = require('mongoose')


const ProblemNameSchema = new mongoose.Schema({

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

module.exports = mongoose.model('problemname', ProblemNameSchema)