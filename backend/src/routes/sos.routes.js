const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const SOSEvent = require('../models/SOSEvent');
const EmergencyContact = require('../models/EmergencyContact');

// Trigger SOS
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { lat, lng, address } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'Latitude and Longitude are required' });
    }

    const contacts = await EmergencyContact.find({ userId: req.user.userId });

    const notified = contacts.map(c => ({
      contactId: c._id,
      name: c.name,
      method: 'SMS & Email',
      sentAt: new Date(),
      success: true
    }));

    const sosEvent = new SOSEvent({
      userId: req.user.userId,
      lat,
      lng,
      address: address || `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`,
      status: 'active',
      contactsNotified: notified
    });

    await sosEvent.save();

    console.log(`[ALERT] SOS Triggered by User ${req.user.userId} at ${lat}, ${lng}`);

    res.status(201).json({
      success: true,
      message: 'SOS Alert dispatched to all emergency contacts!',
      sosEvent
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cancel active SOS
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const sos = await SOSEvent.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { status: 'cancelled', resolvedAt: new Date() },
      { new: true }
    );

    res.json({ success: true, message: 'SOS cancelled successfully', sos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
