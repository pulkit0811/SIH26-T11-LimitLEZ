const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const Notification = require('../models/Notification');

const mongoose = require('mongoose');

// In-memory fallback notifications store
let inMemoryNotifications = [
  { _id: 'n1', userId: 'system', type: 'flood_alert', title: 'HYDROMET SYSTEM ACTIVE', body: 'Real-time flood risk monitoring is active for your area.', read: false, createdAt: new Date() }
];

// Get user notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    let notifications = [];

    if (isDbConnected) {
      notifications = await Notification.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    } else {
      notifications = inMemoryNotifications.filter(n => n.userId === req.user.userId || n.userId === 'system');
    }

    const unreadCount = notifications.filter(n => !n.read).length;

    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// Mark all as read
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      await Notification.updateMany({ $or: [{ userId: req.user.userId }, { userId: 'system' }] }, { read: true });
    } else {
      inMemoryNotifications.forEach(n => {
        n.read = true;
      });
    }


    res.json({ success: true, message: 'All notifications marked as read', unreadCount: 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
