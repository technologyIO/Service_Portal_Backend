const mongoose = require('mongoose');

const CitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true
    },
    cityID: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    modifiedAt: {
        type: Date,
        default: Date.now
    },
    state: {
        type: String,
        required: true  
    },
    stateId: {
        type: String,
        required: true 
    }
});

module.exports = mongoose.model('City', CitySchema);
