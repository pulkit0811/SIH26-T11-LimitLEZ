const API_BASE_URL = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname)
  ? 'http://localhost:5000/api' 
  : '/api';

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

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
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
      console.error(`[API ERROR] ${endpoint}:`, error.message);
      throw error;
    }
  }

  static get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
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
