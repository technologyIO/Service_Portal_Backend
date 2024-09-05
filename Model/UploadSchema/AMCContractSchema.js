const mongoose = require("mongoose");

const AMCContractSchema = new mongoose.Schema({
    salesdoc: {
        type: String,
        required: true
    },
    startdate: {
        type: Date,
        required: true
    },
    enddate: {
        type: Date,
        required: true
    },
    satypeZDRC_ZDRN: {
        type: String,
        required: true
    },
    serialnumber: {
        type: String,
        required: true
    },
    materialcode: {
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
    }
});

module.exports = mongoose.model("AMCContract", AMCContractSchema);
