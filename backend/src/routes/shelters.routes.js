const express = require('express');
const router = express.Router();
const Shelter = require('../models/Shelter');
const mongoose = require('mongoose');
const fetch = globalThis.fetch || ((...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)));

async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function findNearbyOpenStreetMapShelters(lat, lng) {
  const query = `[out:json][timeout:5];(nwr["amenity"~"shelter|community_centre|school|hospital"](around:10000,${lat},${lng}););out center tags;`;
  const response = await fetchWithTimeout(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'LimitFLOOD-App/1.0' }
  });
  if (!response.ok) throw new Error(`Shelter lookup failed with status ${response.status}`);

  const data = await response.json();
  return (data.elements || []).map(item => {
    const tags = item.tags || {};
    const itemLat = item.lat ?? item.center?.lat;
    const itemLng = item.lon ?? item.center?.lon;
    if (!Number.isFinite(itemLat) || !Number.isFinite(itemLng)) return null;
    return {
      _id: `osm_${item.type}_${item.id}`,
      name: tags.name || tags['name:en'] || `${(tags.amenity || 'facility').replace('_', ' ')} nearby`,
      address: [tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', ') || 'Address unavailable',
      lat: itemLat,
      lng: itemLng,
      capacity: Number(tags.capacity) || 0,
      currentOccupancy: 0,
      status: 'open',
      amenities: tags.amenity === 'hospital' ? ['Medical'] : ['Water', 'Beds'],
      source: 'OpenStreetMap'
    };
  }).filter(Boolean).slice(0, 20);
}

// Haversine distance helper (km)
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Get nearby shelters dynamically centered on user coordinates
router.get('/', async (req, res) => {
  try {
    const userLat = parseFloat(req.query.lat) || 26.8467;
    const userLng = parseFloat(req.query.lng) || 80.9462;
    const isDbConnected = mongoose.connection.readyState === 1;
    let shelters = [];

    if (isDbConnected) {
      shelters = await Shelter.find({}).lean();
    }

    // If the database is empty, query real mapped facilities instead of
    // fabricating shelter names and synthetic coordinates.
    if (!shelters || shelters.length === 0) {
      try {
        shelters = await findNearbyOpenStreetMapShelters(userLat, userLng);
      } catch (lookupError) {
        console.warn('[SHELTERS] OpenStreetMap lookup failed:', lookupError.message);
        shelters = [];
      }
    }

    // Attach computed distance & drive time relative to user's location
    shelters = shelters.map(s => {
      const dist = getDistanceKm(userLat, userLng, s.lat, s.lng);
      const driveTime = Math.max(2, Math.round(dist * 3.2));
      return {
        ...s,
        distanceKm: parseFloat(dist.toFixed(1)),
        driveTimeMinutes: driveTime
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ success: true, shelters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
