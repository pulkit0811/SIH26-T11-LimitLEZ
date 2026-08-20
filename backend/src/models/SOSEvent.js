const mongoose = require('mongoose');

const SOSEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  },
  address: {
    type: String,
    default: 'Location coordinates attached'
  },
  status: {
    type: String,
    enum: ['active', 'sent', 'acknowledged', 'cancelled', 'resolved'],
    default: 'active'
  },
  contactsNotified: [{
    contactId: mongoose.Schema.Types.ObjectId,
    name: String,
    method: String,
    sentAt: Date,
    success: Boolean
  }],
  resolvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('SOSEvent', SOSEventSchema);
