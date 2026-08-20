const http = require('http');
const mongoose = require('mongoose');
const app = require('./src/app');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/limitflood';

const server = http.createServer(app);

// Disable Mongoose query buffering so offline mode falls back immediately without 10s timeout
mongoose.set('bufferCommands', false);

// Start Server Immediately
server.listen(PORT, () => {
  console.log(`[SERVER] LimitFLOOD backend listening on http://localhost:${PORT}`);
});

// Connect to MongoDB asynchronously
mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 })
  .then(() => {
    console.log('[DATABASE] Connected to MongoDB');
  })
  .catch((err) => {
    console.warn('[DATABASE WARNING] Could not connect to MongoDB (Running in standalone mode):', err.message);
  });
