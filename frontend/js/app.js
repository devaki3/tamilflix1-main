// App - Main orchestrator
let currentPage = 'home';

// Page management
function showPage(page) {
  // Hide all pages
  ['home', 'movie', 'quiz', 'recommendation', 'watch-together'].forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.add('hidden');
  });

  // Show requested page
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('fade-in-up');
    setTimeout(() => target.classList.remove('fade-in-up'), 600);
  }

  currentPage = page;

  // Special actions per page
  if (page === 'quiz') {
    startQuiz();
  }

  // Close search results
  document.getElementById('search-results')?.classList.add('hidden');
  if (document.getElementById('search-input')) {
    document.getElementById('search-input').value = '';
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toast notifications
function showToast(icon, message, duration = 3000) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-icon').textContent = icon;
  document.getElementById('toast-msg').textContent = message;
  
  toast.classList.remove('hidden');
  toast.style.opacity = '1';

  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, duration);
}

// App initialization
async function loadApp() {
  showPage('home');
  await loadMovies();
}

// Check if user is already logged in
function checkExistingSession() {
  const token = localStorage.getItem('tamilflix_token');
  const userStr = localStorage.getItem('tamilflix_user');
  
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      if (isTokenValid(token)) {
        document.getElementById('profile-avatar').textContent = user.name.charAt(0).toUpperCase();
        document.getElementById('profile-name-menu').textContent = user.name;
        document.getElementById('profile-email-menu').textContent = user.email;
        showApp();
        return true;
      }
    } catch (e) {}
    localStorage.removeItem('tamilflix_token');
    localStorage.removeItem('tamilflix_user');
  }
  return false;
}

// Mobile search toggle
function toggleMobileSearch() {
  const input = document.getElementById('search-input');
  if (input) {
    input.classList.toggle('hidden');
    if (!input.classList.contains('hidden')) input.focus();
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // ESC closes overlays
  if (e.key === 'Escape') {
    document.getElementById('search-results')?.classList.add('hidden');
    document.getElementById('profile-menu')?.classList.add('hidden');
  }
  // Ctrl+K for search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('search-input')?.focus();
  }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  // Check for existing session
  if (!checkExistingSession()) {
    // Show auth screen (already visible by default)
    switchTab('login');
  }
});
