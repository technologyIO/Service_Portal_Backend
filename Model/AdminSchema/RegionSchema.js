const mongoose = require('mongoose');

const regionSchema = new mongoose.Schema({
  regionName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  states: [String],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Region = mongoose.model('Region', regionSchema);
module.exports = Region;