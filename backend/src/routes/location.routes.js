const express = require('express');
const fetch = globalThis.fetch || ((...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)));
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');

// Search location using OpenStreetMap Nominatim API
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: 'Query parameter q is required' });
    }

    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'LimitFLOOD-App/1.0' }
    });

    const data = await response.json();
    const results = data.map(item => ({
      name: item.display_name.split(',')[0],
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      region: item.display_name.split(',').slice(1, -1).join(',').trim(),
      country: item.display_name.split(',').pop().trim()
    }));

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reverse Geocode coordinates to place name
router.get('/reverse', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng parameters are required' });
    }

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: { 'User-Agent': 'LimitFLOOD-App/1.0' }
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed with status ${response.status}`);
    }

    const data = await response.json();
    const address = data.address || {};
    const name = address.neighbourhood ||
      address.suburb ||
      address.city_district ||
      address.town ||
      address.city ||
      address.village ||
      address.municipality ||
      (data.display_name ? data.display_name.split(',')[0].trim() : '') ||
      `Location (${parseFloat(lat).toFixed(3)}, ${parseFloat(lng).toFixed(3)})`;
    const displayName = data.display_name || name;

    res.json({
      success: true,
      location: {
        name,
        displayName,
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
