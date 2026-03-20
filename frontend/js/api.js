// API Helper - Centralized fetch wrapper
// Falls back to static data (STATIC_MOVIES) when backend is unavailable
const API = {
  BASE: '/api',
  staticMode: false, // auto-detected on first request failure

  getToken() {
    return localStorage.getItem('tamilflix_token');
  },

  headers(withAuth = false) {
    const h = { 'Content-Type': 'application/json' };
    if (withAuth) {
      const token = this.getToken();
      if (token) h['Authorization'] = `Bearer ${token}`;
    }
    return h;
  },

  async post(path, body, auth = false) {
    const res = await fetch(`${this.BASE}${path}`, {
      method: 'POST',
      headers: this.headers(auth),
      body: JSON.stringify(body)
    });
    return res.json();
  },

  async get(path, auth = false) {
    const res = await fetch(`${this.BASE}${path}`, {
      headers: this.headers(auth)
    });
    return res.json();
  },

  // Auth — no static fallback for auth (requires server)
  signup: (data) => API.post('/auth/signup', data),
  verifyOtp: (data) => API.post('/auth/verify-otp', data),
  login: (data) => API.post('/auth/login', data),
  resendOtp: (data) => API.post('/auth/resend-otp', data),

  // Movies — with static fallback
  async getMovies(params = '') {
    try {
      const result = await API.get(`/movies${params}`);
      if (result && !result.error) return result;
      throw new Error('Backend unavailable');
    } catch {
      API.staticMode = true;
      if (params.includes('search=')) {
        const q = decodeURIComponent(params.split('search=')[1]).toLowerCase();
        return STATIC_MOVIES.filter(m => m.title.toLowerCase().includes(q));
      }
      if (params.includes('genre=')) {
        const g = decodeURIComponent(params.split('genre=')[1]);
        return STATIC_MOVIES.filter(m => m.genre.includes(g));
      }
      return STATIC_MOVIES;
    }
  },
  async getMovie(id) {
    try {
      const result = await API.get(`/movies/${id}`);
      if (result && !result.error) return result;
      throw new Error();
    } catch {
      API.staticMode = true;
      return STATIC_MOVIES.find(m => m.id === parseInt(id)) || null;
    }
  },
  searchMovies: (q) => API.getMovies(`?search=${encodeURIComponent(q)}`),
  getMoviesByGenre: (genre) => API.getMovies(`?genre=${encodeURIComponent(genre)}`),
  async getRecommendation(answers) {
    if (!API.staticMode) {
      try {
        const result = await API.post('/movies/recommend', { answers }, true);
        if (result && !result.error) return result;
      } catch {}
    }
    // Client-side fallback
    return getRecommendation(answers);
  },

  // Rooms
  createRoom: (movieId) => API.post('/rooms/create', { movieId }, true),
  joinRoom: (roomCode) => API.post('/rooms/join', { roomCode }, true)
};
