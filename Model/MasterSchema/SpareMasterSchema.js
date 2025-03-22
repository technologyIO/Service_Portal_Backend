const mongoose = require("mongoose");

const SpareMasterSchema = new mongoose.Schema(
  {
    Sub_grp: { type: String, required: true, trim: true },
    PartNumber: { type: String, required: true, unique: true, trim: true },
    Description: { type: String, required: true, trim: true },
    Type: { type: String, required: true, trim: true },
    Rate: { type: Number, required: true }, // MRP
    DP: { type: Number, required: true }, // Dealer Price
    Charges: { type: Number, required: true } // Exchange Price
  },
  { timestamps: true }
);

module.exports = mongoose.model("sparemaster", SpareMasterSchema);
