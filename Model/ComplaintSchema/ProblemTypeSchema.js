const mongoose = require('mongoose');

// Define the schema for problem types
const problemtypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true // Add required validation if necessary
    },
    status: {
        type: Boolean,
        default: true // Default status can be true if required
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    modifiedAt: {
        type: Date,
        default: Date.now // Fixed to Date.now()
    }
});

// Export the model using a proper name
module.exports = mongoose.model('ProblemType', problemtypeSchema);
