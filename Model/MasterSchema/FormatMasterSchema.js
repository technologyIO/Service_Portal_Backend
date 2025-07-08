const mongoose = require("mongoose");

const formatMasterSchema = new mongoose.Schema(
  {
    productGroup: { type: String, required: true },
    chlNo: { type: String, required: true },
    revNo: { type: Number, required: true },
    type: { type: String, required: true },
    status: { type: String, default: "Active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FormatMaster", formatMasterSchema);
