const User = require('../models/User');
const OtpVerification = require('../models/OtpVerification');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const mongoose = require('mongoose');

// In-memory fallback stores when MongoDB is not connected
const inMemoryUsers = [];
const inMemoryOtps = [];

exports.inMemoryUsers = inMemoryUsers;
exports.inMemoryOtps = inMemoryOtps;


// Signup - Step 1: Create Account & Send OTP
exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email is already registered' });
      }

      const newUser = new User({ name, email, phone, passwordHash });
      await newUser.save();
      await OtpVerification.create({ phone, otpHash });
    } else {
      // In-Memory Fallback Mode
      const existing = inMemoryUsers.find(u => u.email === email);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email is already registered' });
      }
      const fakeId = 'user_' + Date.now();
      inMemoryUsers.push({ _id: fakeId, id: fakeId, name, email, phone, passwordHash, isPhoneVerified: false });
      inMemoryOtps.push({ phone, otpHash, createdAt: new Date() });
    }

    console.log(`[DEVELOPMENT ONLY] OTP for ${phone}: ${otp}`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please verify your phone number.',
      phone,
      // Set SHOW_DEV_OTP=true on a development/demo deployment to display the
      // generated OTP in the verification page. Keep it disabled by default.
      devOtp: (process.env.NODE_ENV !== 'production' || process.env.SHOW_DEV_OTP === 'true') ? otp : undefined
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify OTP - Step 2
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    let user;

    if (isDbConnected) {
      const record = await OtpVerification.findOne({ phone }).sort({ createdAt: -1 });
      if (!record) {
        return res.status(400).json({ success: false, message: 'OTP expired or invalid' });
      }

      const isMatch = await bcrypt.compare(otp, record.otpHash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect OTP' });
      }

      await User.findOneAndUpdate({ phone }, { isPhoneVerified: true });
      await OtpVerification.deleteMany({ phone });
      user = await User.findOne({ phone });
    } else {
      const record = inMemoryOtps.find(r => r.phone === phone);
      if (!record) {
        return res.status(400).json({ success: false, message: 'OTP expired or invalid' });
      }
      const isMatch = await bcrypt.compare(otp, record.otpHash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect OTP' });
      }
      user = inMemoryUsers.find(u => u.phone === phone);
      if (user) user.isPhoneVerified = true;
    }

    const userId = user ? user._id : 'user_default';
    const email = user ? user.email : 'user@example.com';

    const token = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET || 'super_secret_limitflood_jwt_key_2026_dev',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Phone verified successfully',
      token,
      user: {
        id: userId,
        name: user ? user.name : 'User',
        email: email,
        phone: phone
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    let user;

    if (isDbConnected) {
      user = await User.findOne({ email });
    } else {
      user = inMemoryUsers.find(u => u.email === email);
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'super_secret_limitflood_jwt_key_2026_dev',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar || ''
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
