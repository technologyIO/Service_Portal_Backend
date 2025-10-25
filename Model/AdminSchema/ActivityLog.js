// models/ActivityLog.js
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  // User Information
  user: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true
    },
    avatar: {
      type: String,
      default: ''
    }
  },

  // Action Details
  action: {
    type: String,
    required: true,
  },

  // Description and Details
  description: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: ''
  },

  // Module/Section
  module: {
    type: String,
    required: true,
  },

  // Status and Severity
  status: {
    type: String,
    required: true,
    enum: ['success', 'warning', 'error', 'info'],
    default: 'info'
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'info', 'medium', 'warning', 'high', 'critical'],
    default: 'info'
  },

  // Technical Details
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  device: {
    type: String,
    default: ''
  },

  // Related Data
  relatedId: {
    type: String, // Equipment ID, Customer ID, etc.
    default: ''
  },
  relatedModel: {
    type: String, // Equipment, Customer, etc.
    default: ''
  },

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now
  },
  
  // Auto-delete after 30 days (optional)
  expiresAt: {
    type: Date,
    default: Date.now,
    expires: 2592000 // 30 days in seconds
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'activity_logs'
});

// Indexes for better performance
activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ 'user.id': 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ module: 1, timestamp: -1 });
activityLogSchema.index({ status: 1, timestamp: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
