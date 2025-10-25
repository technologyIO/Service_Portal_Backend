const mongoose = require('mongoose');

const geoSchema = new mongoose.Schema({
  geoName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  status: {
    type: String,
    default: "Active"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Geo = mongoose.model('Geo', geoSchema);

module.exports = Geo;