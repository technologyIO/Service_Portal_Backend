// JobProgress Schema - add this file: Model/JobProgressSchema.js
const mongoose = require('mongoose');

const JobProgressSchema = new mongoose.Schema({
  jobId: { type: String, unique: true, required: true },
  status: { 
    type: String, 
    enum: ['PROCESSING', 'COMPLETED', 'FAILED'],
    default: 'PROCESSING' 
  },
  fileName: { type: String, required: true },
  fileSize: { type: Number },
  totalRecords: { type: Number, default: 0 },
  processedRecords: { type: Number, default: 0 },
  createdCount: { type: Number, default: 0 },
  updatedCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  pmCount: { type: Number, default: 0 },
  progressPercentage: { type: Number, default: 0 },
  currentOperation: { type: String, default: 'Starting...' },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  estimatedEndTime: { type: Date },
  errorMessage: { type: String },
  errorSummary: [{ type: mongoose.Schema.Types.Mixed }],
  fieldMappingInfo: {
    detectedFields: [String],
    mappedFields: [String],
    unmappedFields: [String]
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('JobProgress', JobProgressSchema);
