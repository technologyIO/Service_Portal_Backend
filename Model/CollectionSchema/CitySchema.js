const mongoose = require('mongoose');
const CitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true  // This ensures city names are unique globally
    },
    status: {
        type: String,
    },
    cityID: {
        type: String,
        unique: true,
        sparse: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    modifiedAt: {
        type: Date,
        default: Date.now
    },
    branch: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('City', CitySchema);
