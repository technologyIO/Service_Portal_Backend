const mongoose = require('mongoose');

const EquipmentSchema = new mongoose.Schema({
  materialdescription: {
    type: String,
    required: true
  },
  serialnumber: {
    type: String,
    required: true,
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
    type: String,
    required: true
  },
  endcustomer: {
    type: String,
    required: true
  },
  equipmentid: {
    type: String,
    required: true,
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
    type: String,
    required: true
  },
  palnumber: {
    type: String
  },
  // NEW FIELD: Installation Report No. (unique)
  installationreportno: {
    type: String,
  }
});

module.exports = mongoose.model('Equipment', EquipmentSchema);


