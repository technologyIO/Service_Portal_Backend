const mongoose = require("mongoose");

const SpareMasterSchema = new mongoose.Schema(
  {
    Sub_grp: { type: String, required: true, trim: true },
    PartNumber: { type: String, required: true, unique: true, trim: true },
    Description: { type: String, trim: true },
    Type: { type: String, trim: true },
    Rate: { type: Number }, // MRP
    DP: { type: Number }, // Dealer Price
    Charges: {
      type: mongoose.Schema.Types.Mixed, // Allows both numbers and strings
      required: false // Make it optional
    }, // Exchange Price
    spareiamegUrl: { type: String } // New field for image URL
  },
  { timestamps: true }
);

module.exports = mongoose.model("sparemaster", SpareMasterSchema);
