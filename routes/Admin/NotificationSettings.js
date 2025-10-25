const express = require('express');
const router = express.Router();
const NotificationSettings = require('../../Model/AdminSchema/NotificationSettingsSchema');

// GET notification settings
router.get('/', async (req, res) => {
  try {
    let settings = await NotificationSettings.findOne();
    
    // If no settings exist, create default ones
    if (!settings) {
      settings = new NotificationSettings({
        abortInstallationRecipients: [],
        cicRecipients: []
      });
      await settings.save();
    }

    res.json({
      success: true,
      data: {
        abortInstallationRecipients: settings.abortInstallationRecipients || [],
        cicRecipients: settings.cicRecipients || []
      }
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification settings'
    });
  }
});

// PUT update abort installation recipients
router.put('/abort', async (req, res) => {
  try {
    const { emails } = req.body;
    
    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        error: 'Emails array is required'
      });
    }

    let settings = await NotificationSettings.findOne();
    
    if (!settings) {
      settings = new NotificationSettings();
    }
    
    settings.abortInstallationRecipients = emails;
    await settings.save();

    res.json({
      success: true,
      data: settings,
      message: 'Abort installation recipients updated successfully'
    });
  } catch (error) {
    console.error('Error updating abort installation recipients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update abort installation recipients'
    });
  }
});

// PUT update CIC recipients
router.put('/cic', async (req, res) => {
  try {
    const { emails } = req.body;
    
    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        error: 'Emails array is required'
      });
    }

    let settings = await NotificationSettings.findOne();
    
    if (!settings) {
      settings = new NotificationSettings();
    }
    
    settings.cicRecipients = emails;
    await settings.save();

    res.json({
      success: true,
      data: settings,
      message: 'CIC recipients updated successfully'
    });
  } catch (error) {
    console.error('Error updating CIC recipients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update CIC recipients'
    });
  }
});

// DELETE single email from abort list
router.delete('/abort', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    let settings = await NotificationSettings.findOne();
    if (!settings) {
      return res.status(404).json({ success: false, error: 'Notification settings not found' });
    }

    settings.abortInstallationRecipients = (settings.abortInstallationRecipients || []).filter(
      (e) => (e || '').toLowerCase() !== String(email).toLowerCase()
    );

    await settings.save();

    res.json({ success: true, data: settings, message: 'Email removed from abort recipients' });
  } catch (error) {
    console.error('Error deleting abort recipient:', error);
    res.status(500).json({ success: false, error: 'Failed to delete abort recipient' });
  }
});

// DELETE single email from cic list
router.delete('/cic', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    let settings = await NotificationSettings.findOne();
    if (!settings) {
      return res.status(404).json({ success: false, error: 'Notification settings not found' });
    }

    settings.cicRecipients = (settings.cicRecipients || []).filter(
      (e) => (e || '').toLowerCase() !== String(email).toLowerCase()
    );

    await settings.save();

    res.json({ success: true, data: settings, message: 'Email removed from CIC recipients' });
  } catch (error) {
    console.error('Error deleting CIC recipient:', error);
    res.status(500).json({ success: false, error: 'Failed to delete CIC recipient' });
  }
});

module.exports = router;
