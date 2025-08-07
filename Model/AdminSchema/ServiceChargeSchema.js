const mongoose = require('mongoose');

const ServiceChargeSchema = new mongoose.Schema({
  partNumber: { type: String, required: true },
  description: { type: String, required: true },
  Product: { type: String, required: true },
  cmcPrice: { type: Number, required: true },
  ncmcPrice: { type: Number, required: true },
  status: {
    type: String,
    default: "Active"
  },
  onCallVisitCharge: {
    withinCity: { type: Number, required: true },
    outsideCity: { type: Number, required: true }
  },
  remarks: { type: String }
});

module.exports = mongoose.model('ServiceCharge', ServiceChargeSchema);
