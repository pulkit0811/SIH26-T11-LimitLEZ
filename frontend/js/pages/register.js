document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  const errorBanner = document.getElementById('error-message');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBanner.style.display = 'none';

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      errorBanner.textContent = 'Passwords do not match';
      errorBanner.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
      const response = await AuthService.signup(name, email, phone, password);
      if (response.success) {
        sessionStorage.setItem('temp_verify_phone', response.phone || phone);
        if (response.devOtp) {
          sessionStorage.setItem('temp_dev_otp', response.devOtp);
        }
        window.location.href = 'register-otp.html';
      }
    } catch (error) {
      errorBanner.textContent = error.message || 'Registration failed';
      errorBanner.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue →';
    }
  });
});
