const mongoose = require('mongoose');

const EmergencyContactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  relation: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['Standby', 'Safe', 'Needs a check-in', 'Location unavailable'],
    default: 'Standby'
  },
  locationName: {
    type: String,
    default: ''
  },
  lat: Number,
  lng: Number,
  notifyBySMS: {
    type: Boolean,
    default: true
  },
  notifyByEmail: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('EmergencyContact', EmergencyContactSchema);
