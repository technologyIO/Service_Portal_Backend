const mongoose = require('mongoose');

const ChecklistItemSchema = new mongoose.Schema({
  checkpoint: { type: String, required: true },
  result: { type: String, required: true },
  remark: { type: String, default: "" }
}, { _id: false });  // _id: false since we don't need a separate id for each checklist item

const EquipmentChecklistSchema = new mongoose.Schema({
  serialNumber: { type: String, required: true },
  checklistResults: { type: [ChecklistItemSchema], default: [] },
  globalRemark: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model('EquipmentChecklist', EquipmentChecklistSchema);
