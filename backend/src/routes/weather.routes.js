const express = require('express');
const fetch = globalThis.fetch || ((...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)));
const router = express.Router();

// 5-Minute In-Memory Weather Cache
const weatherCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

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
    const lat = parseFloat(req.query.lat) || 26.8467;
    const lng = parseFloat(req.query.lng) || 80.9462;
    const cacheKey = `weather_${lat.toFixed(3)}_${lng.toFixed(3)}`;

    // Return instant cached response if valid
    const cached = weatherCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return res.json({ success: true, data: cached.data });
    }

    let data = {};
    let liveData = false;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m&hourly=precipitation,temperature_2m&forecast_days=1`;
    
    try {
      const response = await fetchWithTimeout(weatherUrl, 8000);
      if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
      data = await response.json();
      liveData = Boolean(data.current || data.hourly);
    } catch (fetchErr) {
      console.warn('[WEATHER] Open-Meteo timeout/error, using fast telemetry model:', fetchErr.message);
    }

    const current = data.current || {};
    const hourly = data.hourly || {};

    const temp = current.temperature_2m !== undefined ? Math.round(current.temperature_2m) : 28;
    const humidity = current.relative_humidity_2m !== undefined ? Math.round(current.relative_humidity_2m) : 75;
    const rainfall = current.precipitation !== undefined ? current.precipitation : 0;
    const windSpeed = current.wind_speed_10m !== undefined ? Math.round(current.wind_speed_10m) : 14;

    const weatherPayload = {
      temperature: temp,
      humidity: humidity,
      rainfall: rainfall,
      windSpeed: windSpeed,
      hourlyPrecipitation: (hourly.precipitation && hourly.precipitation.length > 0) ? hourly.precipitation.slice(0, 12) : [0.5, 1.2, 2.8, 4.5, 3.2, 1.8, 0.6, 0.2, 0.0, 0.0, 0.0, 0.0],
      lastFetched: new Date().toISOString(),
      liveData,
      source: liveData ? 'Open-Meteo live data' : 'Fallback telemetry (Open-Meteo unavailable)'
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
