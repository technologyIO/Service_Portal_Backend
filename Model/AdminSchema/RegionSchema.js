const mongoose = require('mongoose');

const regionSchema = new mongoose.Schema({
  regionName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  country: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Region = mongoose.model('Region', regionSchema);
module.exports = Region;
