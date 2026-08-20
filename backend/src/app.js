const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

const path = require('path');

// Security & Parsing Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../../frontend')));

// Import Routes
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const locationRoutes = require('./routes/location.routes');
const weatherRoutes = require('./routes/weather.routes');
const floodRiskRoutes = require('./routes/floodRisk.routes');
const sosRoutes = require('./routes/sos.routes');
const contactsRoutes = require('./routes/contacts.routes');
const sheltersRoutes = require('./routes/shelters.routes');
const notificationsRoutes = require('./routes/notifications.routes');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/flood-risk', floodRiskRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/shelters', sheltersRoutes);
app.use('/api/notifications', notificationsRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'LimitFLOOD API Server Running', timestamp: new Date() });
});

// Global Error Middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
});

module.exports = app;
