const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const EmergencyContact = require('../models/EmergencyContact');

const mongoose = require('mongoose');

// In-memory fallback emergency contacts store (starts EMPTY for new users)
let inMemoryContacts = [];

// Get user emergency contacts
router.get('/', authMiddleware, async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    let contacts = [];

    if (isDbConnected) {
      contacts = await EmergencyContact.find({ userId: req.user.userId });
    } else {
      contacts = inMemoryContacts.filter(c => c.userId === req.user.userId);
    }

    res.json({ success: true, contacts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// Add contact
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, relation, phone, email } = req.body;
    if (!name || !relation || !phone) {
      return res.status(400).json({ success: false, message: 'Name, relation, and phone are required' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    let contact;

    if (isDbConnected) {
      contact = new EmergencyContact({
        userId: req.user.userId,
        name,
        relation,
        phone,
        email: email || '',
        status: 'Standby'
      });
      await contact.save();
    } else {
      contact = {
        _id: 'c_' + Date.now(),
        userId: req.user.userId || 'user_default',
        name,
        relation,
        phone,
        email: email || '',
        status: 'Standby',
        locationName: 'Location pending'
      };
      inMemoryContacts.push(contact);
    }

    res.status(201).json({ success: true, contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update (Edit) contact
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, relation, phone, email } = req.body;
    if (!name || !relation || !phone) {
      return res.status(400).json({ success: false, message: 'Name, relation, and phone are required' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    let contact;

    if (isDbConnected) {
      contact = await EmergencyContact.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.userId },
        { name, relation, phone, email: email || '' },
        { new: true }
      );
    } else {
      const idx = inMemoryContacts.findIndex(c => c._id === req.params.id);
      if (idx !== -1) {
        inMemoryContacts[idx] = {
          ...inMemoryContacts[idx],
          name,
          relation,
          phone,
          email: email || ''
        };
        contact = inMemoryContacts[idx];
      }
    }

    res.json({ success: true, message: 'Contact updated successfully', contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete contact
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      await EmergencyContact.deleteOne({ _id: req.params.id, userId: req.user.userId });
    } else {
      inMemoryContacts = inMemoryContacts.filter(c => c._id !== req.params.id);
    }

    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

