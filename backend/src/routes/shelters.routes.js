const express = require('express');
const router = express.Router();
const Shelter = require('../models/Shelter');
const mongoose = require('mongoose');

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
    const locationName = req.query.locationName || 'Local Area';
    const shortName = locationName.split(',')[0].trim();

    const isDbConnected = mongoose.connection.readyState === 1;
    let shelters = [];

    if (isDbConnected) {
      shelters = await Shelter.find({}).lean();
    }

    // If DB empty or running in standalone mode, generate dynamic hyper-local shelters
    if (!shelters || shelters.length === 0) {
      shelters = [
        {
          _id: 's1_' + Math.round(userLat * 100),
          name: `${shortName} Central Relief Center`,
          address: `Sector 4, Main Road, ${shortName}`,
          lat: userLat + 0.006,
          lng: userLng + 0.007,
          capacity: 150,
          currentOccupancy: 65,
          status: 'open',
          amenities: ['Medical', 'Food', 'Water', 'Beds']
        },
        {
          _id: 's2_' + Math.round(userLat * 100),
          name: `${shortName} High School Refuge`,
          address: `Station Road, ${shortName}`,
          lat: userLat - 0.008,
          lng: userLng + 0.005,
          capacity: 250,
          currentOccupancy: 190,
          status: 'near_full',
          amenities: ['Water', 'Beds', 'Power']
        },
        {
          _id: 's3_' + Math.round(userLat * 100),
          name: `${shortName} Municipal Indoor Stadium`,
          address: `Civil Lines, ${shortName}`,
          lat: userLat + 0.014,
          lng: userLng - 0.010,
          capacity: 300,
          currentOccupancy: 85,
          status: 'open',
          amenities: ['Food', 'Water', 'Beds', 'Medical', 'Generator']
        },
        {
          _id: 's4_' + Math.round(userLat * 100),
          name: `${shortName} Community Assembly Hall`,
          address: `Bypass Road, ${shortName}`,
          lat: userLat - 0.018,
          lng: userLng - 0.015,
          capacity: 120,
          currentOccupancy: 0,
          status: 'preparing',
          amenities: ['Food', 'Water', 'Beds']
        }
      ];
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

