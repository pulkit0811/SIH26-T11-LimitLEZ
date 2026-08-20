const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const User = require('../models/User');

const mongoose = require('mongoose');

// In-memory profile store fallback
const inMemoryProfiles = {};

// Get Profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    let user;

    if (isDbConnected) {
      user = await User.findById(req.user.userId).select('-passwordHash');
    } else {
      const { inMemoryUsers } = require('../controllers/auth.controller');
      const found = (inMemoryUsers || []).find(u => u._id === req.user.userId || u.email === req.user.email);

      user = inMemoryProfiles[req.user.userId] || (found ? {
        _id: found._id,
        name: found.name,
        email: found.email,
        phone: found.phone,
        settings: { notifications: { floodAlerts: true, sosAlerts: true }, privacy: { shareLocation: true }, theme: 'light' }
      } : {
        _id: req.user.userId,
        name: req.user.name || '',
        email: req.user.email || '',
        phone: req.user.phone || '',
        settings: { notifications: { floodAlerts: true, sosAlerts: true }, privacy: { shareLocation: true }, theme: 'light' }
      });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Profile
router.put('/', authMiddleware, async (req, res) => {
  try {
    const { name, phone, settings } = req.body;
    const isDbConnected = mongoose.connection.readyState === 1;
    let user;

    if (isDbConnected) {
      user = await User.findById(req.user.userId);
      if (name) user.name = name;
      if (phone) user.phone = phone;
      if (settings) user.settings = { ...user.settings, ...settings };
      await user.save();
    } else {
      const { inMemoryUsers } = require('../controllers/auth.controller');
      const found = (inMemoryUsers || []).find(u => u._id === req.user.userId || u.email === req.user.email);
      
      user = inMemoryProfiles[req.user.userId] || {
        _id: req.user.userId,
        name: found ? found.name : (req.user.name || ''),
        email: req.user.email || '',
        phone: found ? found.phone : (req.user.phone || ''),
        settings: { notifications: { floodAlerts: true, sosAlerts: true }, privacy: { shareLocation: true }, theme: 'light' }
      };
      if (name) {
        user.name = name;
        if (found) found.name = name;
      }
      if (phone) {
        user.phone = phone;
        if (found) found.phone = phone;
      }
      if (settings) user.settings = { ...user.settings, ...settings };
      inMemoryProfiles[req.user.userId] = user;
    }

    res.json({ success: true, message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


module.exports = router;
