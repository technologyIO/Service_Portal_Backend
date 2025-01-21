const mongoose = require('mongoose');

const PMSchema = new mongoose.Schema({
  pmType: {
    type: String,
    required: true,
  },
  pmNumber: {
    type: String,
    required: true,
    unique: true,  
  },
  materialDescription: {
    type: String,
  },
  serialNumber: {
    type: String,
    required: true,
  },
  customerCode: {
    type: String,
   
  },
  regionBranch: {
    type: String,
   
  },
  pmDueMonth: {
    type: String,
    match: /^(0[1-9]|1[0-2])\/\d{4}$/  
  },
  pmDoneDate: {
    type: String,
    match: /^\d{2}\/\d{2}\/\d{4}$/  
  },
  pmVendorCode: {
    type: String,
  },
  pmEngineerCode: {
    type: String,
  },
  pmStatus: {
    type: String,
    enum: ['Completed', 'Due', 'Overdue', 'Lapse'],  
  },
}, {
  timestamps: true,  
});

module.exports = mongoose.model('PM', PMSchema);
