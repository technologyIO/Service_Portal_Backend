const mongoose = require('mongoose');

const CheckPointTypeSchema = new mongoose.Schema({
  name: {
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

module.exports = mongoose.model('CheckPointType', CheckPointTypeSchema);
