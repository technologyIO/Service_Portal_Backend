const mongoose = require('mongoose');

const PMSchema = new mongoose.Schema(
  {
    pmType: {
      type: String,
      required: true,
    },
    pmNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    materialDescription: {
      type: String,
    },
    documentnumber: {
      type: String,
    },
    serialNumber: {
      type: String,
      required: true,
    },
    customerCode: {
      type: String,
    },
    region: {
      type: String,
    },

    city: {
      type: String,
    },
    pmDueMonth: {
      type: String,
      match: /^(0[1-9]|1[0-2])\/\d{4}$/, // Format MM/YYYY
    },
    pmDoneDate: {
      type: String,
      match: /^\d{2}\/\d{2}\/\d{4}$/, // Format DD/MM/YYYY
    },
    pmVendorCode: {
      type: String,
    },
    pmEngineerCode: {
      type: String,
    },
    pmStatus: {
      type: String,
    },
    partNumber: {
      type: String,
    },
    status: {
      type: String,
      default: 'Active',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("PM", PMSchema);
