// Auth Management
let pendingEmail = '';

function switchTab(tab) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const otpForm = document.getElementById('otp-form');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');

  loginForm.classList.add('hidden');
  signupForm.classList.add('hidden');
  otpForm.classList.add('hidden');
  tabLogin.classList.remove('active');
  tabSignup.classList.remove('active');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    tabLogin.classList.add('active');
  } else {
    signupForm.classList.remove('hidden');
    tabSignup.classList.add('active');
  }

  clearErrors();
}

function clearErrors() {
  ['login-error', 'signup-error', 'otp-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.textContent = ''; }
  });
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.classList.remove('hidden');
    el.classList.add('slide-in');
  }
}

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const btn = input.nextElementSibling;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'HIDE';
  } else {
    input.type = 'password';
    btn.textContent = 'SHOW';
  }
}

function setButtonLoading(btnId, textId, loading, defaultText) {
  const btn = document.getElementById(btnId);
  const text = document.getElementById(textId);
  if (loading) {
    btn.disabled = true;
    text.textContent = '...';
    btn.classList.add('opacity-70');
  } else {
    btn.disabled = false;
    text.textContent = defaultText;
    btn.classList.remove('opacity-70');
  }
}

async function handleSignup(e) {
  e.preventDefault();
  clearErrors();

  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;

  // Client-side validation
  if (name.length < 2) return showError('signup-error', 'Name must be at least 2 characters');
  if (!email.endsWith('@gmail.com')) return showError('signup-error', 'Please use a valid Gmail address (@gmail.com)');
  if (password.length < 6) return showError('signup-error', 'Password must be at least 6 characters');
  if (password !== confirm) return showError('signup-error', 'Passwords do not match');

  setButtonLoading('signup-btn', 'signup-btn-text', true, 'CREATE ACCOUNT');

  try {
    const data = await API.signup({ name, email, password });

    if (data.error) {
      showError('signup-error', data.error);
    } else {
      pendingEmail = email;
      showOTPForm(email, data.devOtp);
    }
  } catch (err) {
    showError('signup-error', 'Network error. Please check if the server is running.');
  } finally {
    setButtonLoading('signup-btn', 'signup-btn-text', false, 'CREATE ACCOUNT');
  }
}

function showOTPForm(email, devOtp) {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('signup-form').classList.add('hidden');
  document.getElementById('otp-form').classList.remove('hidden');
  document.getElementById('otp-email-display').textContent = email;

  // Show dev OTP hint if available (development mode)
  if (devOtp) {
    const hint = document.getElementById('dev-otp-hint');
    hint.textContent = `🛠️ Dev Mode: Your OTP is ${devOtp}`;
    hint.classList.remove('hidden');
  }

  // Auto-focus OTP input
  setTimeout(() => document.getElementById('otp-input').focus(), 100);
}

async function handleOTPVerify() {
  const otp = document.getElementById('otp-input').value.trim();
  const errEl = document.getElementById('otp-error');
  errEl.classList.add('hidden');

  if (otp.length !== 6) {
    errEl.textContent = 'Please enter the 6-digit OTP';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('otp-btn');
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    const data = await API.verifyOtp({ email: pendingEmail, otp });

    if (data.error) {
      errEl.textContent = data.error;
      errEl.classList.remove('hidden');
    } else {
      saveAuth(data);
      showToast('✅', 'Email verified! Welcome to TamilFlix!');
      showApp();
    }
  } catch (err) {
    errEl.textContent = 'Network error. Please try again.';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'VERIFY OTP';
  }
}

async function resendOTP() {
  try {
    const data = await API.resendOtp({ email: pendingEmail });
    if (data.devOtp) {
      const hint = document.getElementById('dev-otp-hint');
      hint.textContent = `🛠️ Dev Mode: New OTP is ${data.devOtp}`;
      hint.classList.remove('hidden');
    }
    showToast('📧', 'New OTP sent to your email!');
  } catch (err) {
    showToast('❌', 'Failed to resend OTP');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  clearErrors();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) return showError('login-error', 'Please fill in all fields');

  setButtonLoading('login-btn', 'login-btn-text', true, 'ENTER TAMILFLIX');

  try {
    const data = await API.login({ email, password });

    if (data.error) {
      if (data.needsVerification) {
        pendingEmail = data.email;
        showOTPForm(data.email, null);
      } else {
        showError('login-error', data.error);
      }
    } else {
      saveAuth(data);
      showToast('🎬', `Welcome back, ${data.user.name}!`);
      showApp();
    }
  } catch (err) {
    // Static/offline mode - allow demo login
    if (API.staticMode || err.message?.includes('fetch')) {
      const demoUser = { id: 1, name: email.split('@')[0], email };
      const demoToken = btoa(JSON.stringify({ userId: 1, exp: Date.now()/1000 + 604800 })) + '.demo.sig';
      saveAuth({ token: demoToken, user: demoUser });
      showToast('🎬', `Welcome, ${demoUser.name}! (Demo Mode)`);
      showApp();
    } else {
      showError('login-error', 'Network error. Please check if the server is running.');
    }
  } finally {
    setButtonLoading('login-btn', 'login-btn-text', false, 'ENTER TAMILFLIX');
  }
}

function saveAuth(data) {
  localStorage.setItem('tamilflix_token', data.token);
  localStorage.setItem('tamilflix_user', JSON.stringify(data.user));
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('tamilflix_user'));
  } catch { return null; }
}

// Session check — works with both real JWT and demo token
function isTokenValid(token) {
  try {
    if (token.endsWith('.demo.sig')) {
      const payload = JSON.parse(atob(token.split('.')[0]));
      return payload.exp * 1000 > Date.now();
    }
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch { return false; }
}

function handleLogout() {
  localStorage.removeItem('tamilflix_token');
  localStorage.removeItem('tamilflix_user');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  switchTab('login');
  toggleProfileMenu(true);
  showToast('👋', 'See you again!');
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  
  const user = getUser();
  if (user) {
    document.getElementById('profile-avatar').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('profile-name-menu').textContent = user.name;
    document.getElementById('profile-email-menu').textContent = user.email;
  }

  loadApp();
}

function toggleProfileMenu(forceClose = false) {
  const menu = document.getElementById('profile-menu');
  if (forceClose) {
    menu.classList.add('hidden');
  } else {
    menu.classList.toggle('hidden');
  }
}

// Close profile menu on outside click
document.addEventListener('click', (e) => {
  const menu = document.getElementById('profile-menu');
  const btn = document.getElementById('profile-avatar');
  if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== btn) {
    menu.classList.add('hidden');
  }
  // Close search results on outside click
  const search = document.getElementById('search-results');
  const searchInput = document.getElementById('search-input');
  if (search && !search.classList.contains('hidden') && !search.contains(e.target) && e.target !== searchInput) {
    search.classList.add('hidden');
  }
});
