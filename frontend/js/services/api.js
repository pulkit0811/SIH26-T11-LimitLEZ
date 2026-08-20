const isLocalApp = window.location.protocol === 'file:' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  !window.location.hostname;
const isRenderApp = window.location.hostname.endsWith('onrender.com');

// The backend serves the frontend on Render, but this also supports hosting
// the static frontend separately (for example on Vercel).
const API_BASE_URL = isLocalApp
  ? 'http://localhost:5000/api'
  : isRenderApp
    ? '/api'
    : 'https://limitflood.onrender.com/api';

class ApiService {
  static async request(endpoint, options = {}) {
    const token = localStorage.getItem('limitflood_token');
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    if (config.method === 'GET') {
      config.cache = 'no-store';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 20000);
    config.signal = controller.signal;

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('limitflood_token');
          localStorage.removeItem('limitflood_user');
          if (!window.location.pathname.includes('signin.html') && !window.location.pathname.includes('register.html') && window.location.pathname !== '/') {
            window.location.href = '/pages/signin.html';
          }
        }
        throw new Error(data.message || 'API Request Failed');
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out: ${endpoint}`);
      }
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(`Unable to reach LimitFLOOD API at ${API_BASE_URL}`);
      }
      console.error(`[API ERROR] ${endpoint}:`, error.message);
      throw error;
    }
  }

  static get(endpoint, options = {}) {
    return this.request(endpoint, { method: 'GET', ...options });
  }

  static post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  static put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  static delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}
