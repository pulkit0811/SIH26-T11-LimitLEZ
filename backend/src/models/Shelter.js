const mongoose = require('mongoose');

const ShelterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true
  },
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  },
  capacity: {
    type: Number,
    required: true
  },
  currentOccupancy: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['open', 'near_full', 'preparing', 'closed'],
    default: 'open'
  },
  amenities: [{
    type: String
  }],
  phone: {
    type: String,
    default: ''
  },
  operatedBy: {
    type: String,
    default: 'Municipal Corporation'
  }
}, { timestamps: true });

module.exports = mongoose.model('Shelter', ShelterSchema);
