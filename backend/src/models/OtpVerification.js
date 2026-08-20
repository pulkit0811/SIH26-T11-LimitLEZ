const mongoose = require('mongoose');

const OtpVerificationSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    index: true
  },
  otpHash: {
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Automatically deletes after 10 minutes (600 seconds)
  }
});

module.exports = mongoose.model('OtpVerification', OtpVerificationSchema);
