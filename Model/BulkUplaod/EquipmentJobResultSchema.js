// JobResult Schema - add this file: Model/JobResultSchema.js
const mongoose = require('mongoose');

const JobResultSchema = new mongoose.Schema({
  jobId: { type: String, unique: true, required: true },
  equipmentResults: [{ type: mongoose.Schema.Types.Mixed }],
  pmResults: [{ type: mongoose.Schema.Types.Mixed }],
  summary: { type: mongoose.Schema.Types.Mixed },
  errors: [{ type: mongoose.Schema.Types.Mixed }],
  warnings: [{ type: mongoose.Schema.Types.Mixed }]
}, {
  timestamps: true
});

module.exports = mongoose.model('JobResult', JobResultSchema);
