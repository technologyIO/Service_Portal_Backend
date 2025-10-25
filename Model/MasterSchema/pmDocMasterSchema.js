// models/pmDocMasterSchema.js
const mongoose = require('mongoose');

const pmDocMasterSchema = new mongoose.Schema(
  {
    productGroup: { type: String, required: true },
    chlNo: { type: String, required: true },
    revNo: { type: String, required: true },
    type: { type: String, required: true },
    status: {
      type: String,
      default: 'Active'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    modifiedAt: {
      type: Date,
      default: Date.now
    }
  }
);

module.exports = mongoose.model('PMDocMaster', pmDocMasterSchema);
