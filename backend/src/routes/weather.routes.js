const express = require('express');
const fetch = globalThis.fetch || ((...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)));
const router = express.Router();

// Short cache prevents duplicate requests without making the UI appear frozen.
const weatherCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

// Helper: Fetch with timeout
async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Real Weather API via Open-Meteo
router.get('/', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
    }
    const cacheKey = `weather_${lat.toFixed(3)}_${lng.toFixed(3)}`;

    // Return instant cached response if valid
    const cached = weatherCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return res.json({ success: true, data: cached.data });
    }

    let data;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m&hourly=precipitation,temperature_2m&forecast_days=1`;
    
    try {
      const response = await fetchWithTimeout(weatherUrl, 8000);
      if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
      data = await response.json();
    } catch (fetchErr) {
      console.warn('[WEATHER] Open-Meteo unavailable:', fetchErr.message);
      return res.status(503).json({ success: false, message: 'Live weather data is temporarily unavailable' });
    }

    const current = data.current;
    const hourly = data.hourly;
    if (!current || !hourly || !Array.isArray(hourly.precipitation)) {
      return res.status(502).json({ success: false, message: 'Live weather response was incomplete' });
    }

    const temp = Math.round(current.temperature_2m);
    const humidity = Math.round(current.relative_humidity_2m);
    const rainfall = Number(current.precipitation);
    const windSpeed = Math.round(current.wind_speed_10m);
    if (![temp, humidity, rainfall, windSpeed].every(Number.isFinite)) {
      return res.status(502).json({ success: false, message: 'Live weather response contained invalid values' });
    }

    const weatherPayload = {
      temperature: temp,
      humidity: humidity,
      rainfall: rainfall,
      windSpeed: windSpeed,
      hourlyPrecipitation: hourly.precipitation.slice(0, 12),
      lastFetched: new Date().toISOString(),
      liveData: true,
      source: 'Open-Meteo live data'
    };

    weatherCache.set(cacheKey, { timestamp: Date.now(), data: weatherPayload });

    res.json({
      success: true,
      data: weatherPayload
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
