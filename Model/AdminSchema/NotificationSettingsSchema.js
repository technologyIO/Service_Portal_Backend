// models/NotificationSettings.js
const mongoose = require('mongoose');

const notificationSettingsSchema = new mongoose.Schema({
  abortInstallationRecipients: {
    type: [String],
    default: [],
    validate: {
      validator: function(emails) {
        return emails.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      },
      message: 'Invalid email address in abortInstallationRecipients'
    }
  },
  cicRecipients: {
    type: [String],
    default: [],
    validate: {
      validator: function(emails) {
        return emails.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      },
      message: 'Invalid email address in cicRecipients'
    }
  }
}, { 
  timestamps: true,
  collection: 'notificationSettings'
});

// Remove duplicates before saving
notificationSettingsSchema.pre('save', function(next) {
  this.abortInstallationRecipients = [...new Set(this.abortInstallationRecipients)];
  this.cicRecipients = [...new Set(this.cicRecipients)];
  next();
});

module.exports = mongoose.model('NotificationSettings', notificationSettingsSchema);
