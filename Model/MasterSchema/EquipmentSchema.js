const mongoose = require('mongoose');

const EquipmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  materialdescription: {
    type: String,
    required: true
  },
  serialnumber: {
    type: String,
    required: true,
    unique: true
  },
  materialcode: {
    type: String,
    required: true
  },
  status: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  modifiedAt: {
    type: Date,
    default: Date.now
  },
  currentcustomer: {
    type: String
  },
  endcustomer: {
    type: String
  },
  equipmentid: {
    type: String,
    default: function () {
      return new mongoose.Types.ObjectId().toString();
    },
    unique: true
  },
  custWarrantystartdate: {
    type: String,
    required: true
  },
  custWarrantyenddate: {
    type: String,
    required: true
  },
  dealerwarrantystartdate: {
    type: String
  },
  dealerwarrantyenddate: {
    type: String
  },
  dealer: {
    type: String
  },
  palnumber: {
    type: String
  },

  // NEW FIELD: Installation Report No. (unique)
  installationreportno: {
    type: String,
    unique: true
  }
});

module.exports = mongoose.model('Equipment', EquipmentSchema);
