document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signin-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.getElementById('toggle-password');
  const errorBanner = document.getElementById('error-message');
  const submitBtn = document.getElementById('submit-btn');

  // Toggle Password Visibility
  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
  });

  // Handle Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBanner.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      const response = await AuthService.login(email, password);

      if (response.success) {
        window.location.href = 'dashboard.html';
      }
    } catch (error) {
      errorBanner.textContent = error.message || 'Failed to sign in. Please check credentials.';
      errorBanner.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });
});
