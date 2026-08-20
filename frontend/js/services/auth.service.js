class AuthService {
  static async login(email, password) {
    const data = await ApiService.post('/auth/login', { email, password });
    if (data.token) {
      localStorage.setItem('limitflood_token', data.token);
      localStorage.setItem('limitflood_user', JSON.stringify(data.user));
    }
    return data;
  }

  static async signup(name, email, phone, password) {
    return await ApiService.post('/auth/signup', { name, email, phone, password });
  }

  static async verifyOtp(phone, otp) {
    const data = await ApiService.post('/auth/verify-otp', { phone, otp });
    if (data.token) {
      localStorage.setItem('limitflood_token', data.token);
      localStorage.setItem('limitflood_user', JSON.stringify(data.user));
    }
    return data;
  }

  static logout() {
    localStorage.removeItem('limitflood_token');
    localStorage.removeItem('limitflood_user');
    const isInPagesFolder = window.location.pathname.includes('/pages/') || window.location.href.includes('/pages/');
    window.location.href = isInPagesFolder ? 'signin.html' : 'pages/signin.html';
  }

  static getCurrentUser() {
    const userStr = localStorage.getItem('limitflood_user');
    return userStr ? JSON.parse(userStr) : null;
  }

  static isAuthenticated() {
    return !!localStorage.getItem('limitflood_token');
  }
}

// Global Logo Smart Click Handler (Authenticated -> Dashboard, Unauthenticated -> Landing Page)
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (e) => {
    const logoEl = e.target.closest('.logo');
    if (logoEl) {
      e.preventDefault();
      const token = localStorage.getItem('limitflood_token');
      const inPagesDir = window.location.pathname.includes('/pages/') || window.location.href.includes('/pages/');

      if (token) {
        window.location.href = inPagesDir ? 'dashboard.html' : 'pages/dashboard.html';
      } else {
        window.location.href = inPagesDir ? '../index.html' : 'index.html';
      }
    }
  });
});

