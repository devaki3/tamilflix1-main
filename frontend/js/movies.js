// Movies - Home page, search, detail
let allMovies = [];
let currentHeroMovie = null;
let heroRotateInterval = null;

// Extract YouTube video ID from embed or watch URL
function getYouTubeId(url) {
  if (!url) return null;
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  const watchMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  return null;
}

function buildTrailerPlayer(trailerUrl, title, autoPlay = false) {
  if (!trailerUrl) {
    return `<div style="width:100%;aspect-ratio:16/9;border-radius:12px;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
      <p style="color:#6b7280;font-size:14px;">No trailer available</p>
    </div>`;
  }

  const videoId = getYouTubeId(trailerUrl);
  if (!videoId) {
    return `<div style="width:100%;aspect-ratio:16/9;border-radius:12px;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
      <p style="color:#6b7280;font-size:14px;">Trailer unavailable</p>
    </div>`;
  }

  const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const fallbackThumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const uniqueId = `trailer-${videoId}-${Math.random().toString(36).slice(2,7)}`;

  if (autoPlay) {
    // If autoplay requested, go straight to iframe
    return buildTrailerIframe(videoId, true);
  }

  return `
    <div id="${uniqueId}" style="position:relative;width:100%;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#000;cursor:pointer;"
      onclick="loadTrailerEmbed('${uniqueId}', '${videoId}')">
      <img src="${thumbUrl}"
        onerror="this.src='${fallbackThumb}'"
        alt="${title} Trailer"
        style="width:100%;height:100%;object-fit:cover;display:block;opacity:0.85;">
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;pointer-events:none;">
        <div style="width:72px;height:72px;background:rgba(168,85,247,0.92);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 8px rgba(168,85,247,0.25);">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <span style="color:rgba(255,255,255,0.9);font-size:14px;font-weight:700;text-shadow:0 1px 6px rgba(0,0,0,0.9);letter-spacing:0.03em;">▶ Play Trailer</span>
      </div>
    </div>
  `;
}

function buildTrailerIframe(videoId, autoPlay = false) {
  // youtube-nocookie avoids consent/cookie blocks; origin param helps with localhost
  const origin = encodeURIComponent(location.origin || 'http://localhost:3000');
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1${autoPlay ? '&autoplay=1' : ''}&origin=${origin}`;
  return `
    <iframe
      src="${src}"
      class="trailer-frame"
      allowfullscreen
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      style="border:none;">
    </iframe>
  `;
}

function loadTrailerEmbed(containerId, videoId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.style.cursor = 'default';
  container.style.aspectRatio = '16/9';
  container.innerHTML = buildTrailerIframe(videoId, true);
}

const GENRES = [
  { name: 'Trending 🔥', filter: 'Action', emoji: '🔥' },
  { name: 'Action', filter: 'Action', emoji: '⚔️' },
  { name: 'Romantic', filter: 'Romance', emoji: '❤️' },
  { name: 'Feel Good', filter: 'Feel-Good', emoji: '😊' },
  { name: 'Comedy', filter: 'Comedy', emoji: '😂' },
  { name: 'Thriller', filter: 'Thriller', emoji: '😨' },
  { name: 'Emotional', filter: 'Drama', emoji: '😢' },
  { name: 'Horror', filter: 'Horror', emoji: '👻' },
  { name: 'Classic Tamil', filter: 'classic', emoji: '🏆' }
];

async function loadMovies() {
  try {
    allMovies = await API.getMovies();
    renderHomePage();
  } catch (err) {
    console.error('Failed to load movies:', err);
  }
}

function renderHomePage() {
  if (!allMovies.length) return;

  // Pick a random hero movie (from high-rated)
  const heroMovies = allMovies.filter(m => m.rating >= 7.5);
  const heroMovie = heroMovies[Math.floor(Math.random() * heroMovies.length)];
  setHeroMovie(heroMovie);

  // Render genre rows
  const container = document.getElementById('movie-rows');
  container.innerHTML = '';

  GENRES.forEach(genre => {
    let movies;
    if (genre.filter === 'classic') {
      movies = allMovies.filter(m => Array.isArray(m.tags) && m.tags.includes('classic'));
    } else if (genre.name === 'Trending 🔥') {
      movies = [...allMovies].sort((a, b) => b.rating - a.rating).slice(0, 10);
    } else if (genre.filter === 'Feel-Good') {
      movies = allMovies.filter(m => Array.isArray(m.tags) && m.tags.includes('feel-good'));
    } else {
      movies = allMovies.filter(m => Array.isArray(m.genre) && m.genre.includes(genre.filter));
    }

    if (movies.length > 0) {
      container.innerHTML += renderMovieRow(genre.emoji + ' ' + genre.name, movies);
    }
  });

  // Animate rows
  const rows = container.querySelectorAll('.movie-row');
  rows.forEach((row, i) => {
    row.style.opacity = '0';
    row.style.transform = 'translateY(20px)';
    setTimeout(() => {
      row.style.transition = 'opacity 0.5s, transform 0.5s';
      row.style.opacity = '1';
      row.style.transform = 'translateY(0)';
    }, i * 100);
  });
}

function renderMovieRow(title, movies) {
  const cards = movies.map(movie => renderMovieCard(movie)).join('');
  return `
    <div class="movie-row">
      <div class="movie-row-title">${title} <span>${movies.length} films</span></div>
      <div class="movie-row-scroll">${cards}</div>
    </div>
  `;
}

function renderMovieCard(movie, size = 'card-w') {
  const genres = Array.isArray(movie.genre) ? movie.genre.slice(0,2).join(', ') : '';
  const poster = movie.poster || 'https://via.placeholder.com/180x270/141414/e50914?text=' + encodeURIComponent(movie.title);
  return `
    <div class="movie-card ${size}" onclick="openMovieDetail(${movie.id})">
      <img src="${poster}" alt="${movie.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/180x270/141414/888?text=No+Poster'">
      <div class="rating-badge">⭐ ${movie.rating}</div>
      <div class="movie-card-overlay">
        <div>
          <div class="movie-card-title">${movie.title}</div>
          <div class="movie-card-genre">${genres}</div>
          <div class="text-xs text-red-400 mt-1 font-semibold">${movie.year}</div>
        </div>
      </div>
    </div>
  `;
}

function setHeroMovie(movie) {
  currentHeroMovie = movie;
  const bg = document.getElementById('hero-bg');
  const title = document.getElementById('hero-title');
  const desc = document.getElementById('hero-desc');
  const badge = document.getElementById('hero-badge');

  bg.style.backgroundImage = `url('${movie.poster}')`;
  title.textContent = movie.title;
  desc.textContent = movie.description;
  badge.textContent = (Array.isArray(movie.genre) ? movie.genre[0] : 'Tamil') + ' • ' + movie.year;

  document.getElementById('hero-watch-btn').onclick = () => watchHeroTrailer();
  document.getElementById('hero-together-btn').onclick = () => watchHeroTogether();
}

function watchHeroTrailer() {
  if (currentHeroMovie) openMovieDetail(currentHeroMovie.id, true);
}
function watchHeroTogether() {
  if (currentHeroMovie) openWatchTogether(currentHeroMovie.id);
}

async function openMovieDetail(movieId, autoPlay = false) {
  showPage('movie');

  const page = document.getElementById('page-movie');
  page.innerHTML = `<div class="flex items-center justify-center h-64"><div class="text-gray-500">Loading movie...</div></div>`;

  try {
    const movie = await API.getMovie(movieId);
    if (!movie) { page.innerHTML = '<p class="text-center text-red-400 p-16">Movie not found</p>'; return; }

    const genres = Array.isArray(movie.genre) ? movie.genre : [];
    const cast = Array.isArray(movie.cast) ? movie.cast : [];
    const genreTags = genres.map(g => `<span class="genre-tag">${g}</span>`).join('');
    const castStr = cast.join(' · ');
    const poster = movie.poster || 'https://via.placeholder.com/300x450/141414/888?text=No+Poster';

    page.innerHTML = `
      <div class="movie-detail-hero relative h-[50vh] min-h-[350px] overflow-hidden">
        <div style="background-image:url('${poster}')" class="absolute inset-0 bg-cover bg-center blur-sm scale-110 opacity-30"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent"></div>
        <div class="relative h-full flex items-end px-6 md:px-12 pb-10">
          <div class="flex gap-6 items-end">
            <img src="${poster}" alt="${movie.title}" class="movie-detail-poster w-32 md:w-44 hidden md:block" onerror="this.style.display='none'">
            <div>
              <div class="flex flex-wrap gap-2 mb-3">${genreTags}</div>
              <h1 class="text-3xl md:text-5xl font-extrabold mb-2 hero-title-font">${movie.title}</h1>
              <div class="flex items-center gap-4 text-sm text-gray-400 mb-3">
                <span>⭐ <strong class="text-yellow-400">${movie.rating}</strong>/10</span>
                <span>📅 ${movie.year}</span>
                <span>🎬 ${movie.director}</span>
              </div>
              <div class="flex gap-3 flex-wrap">
                <button onclick="document.getElementById('movie-trailer-section').scrollIntoView({behavior:'smooth'})"
                  class="bg-white text-black font-bold px-5 py-2.5 rounded-lg hover:bg-gray-200 transition-all text-sm flex items-center gap-2">
                  ▶ Watch Trailer
                </button>
                <button onclick="openWatchTogether(${movie.id})"
                  class="bg-red-600 text-white font-bold px-5 py-2.5 rounded-lg hover:bg-red-500 transition-all text-sm flex items-center gap-2">
                  👥 Watch Together
                </button>
                <button onclick="showPage('home')" class="bg-white/10 text-white font-bold px-5 py-2.5 rounded-lg hover:bg-white/20 transition-all text-sm">
                  ← Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 md:px-12 py-8 max-w-4xl">
        <div class="grid md:grid-cols-3 gap-8 mb-8">
          <div class="md:col-span-2">
            <h2 class="text-lg font-bold mb-3 text-red-500">About the Film</h2>
            <p class="text-gray-300 text-sm leading-relaxed">${movie.description}</p>
          </div>
          <div class="space-y-4">
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Cast</div>
              <div class="text-sm text-gray-200">${castStr || 'N/A'}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Director</div>
              <div class="text-sm text-gray-200">${movie.director}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Pace</div>
              <div class="text-sm text-gray-200">${movie.pace}</div>
            </div>
          </div>
        </div>

        <!-- Trailer -->
        <div id="movie-trailer-section">
          <h2 class="text-lg font-bold mb-4 text-red-500">🎬 Official Trailer</h2>
          ${buildTrailerPlayer(movie.trailer, movie.title, autoPlay)}
        </div>

        <!-- More movies row -->
        <div class="mt-10">
          <h2 class="text-lg font-bold mb-4">More Tamil Films</h2>
          <div class="movie-row-scroll">
            ${allMovies.filter(m => m.id !== movie.id).slice(0, 8).map(m => renderMovieCard(m)).join('')}
          </div>
        </div>
      </div>
    `;

    if (autoPlay) {
      setTimeout(() => document.getElementById('movie-trailer-section')?.scrollIntoView({ behavior: 'smooth' }), 300);
    }

  } catch (err) {
    page.innerHTML = '<p class="text-center text-red-400 p-16">Failed to load movie details.</p>';
  }
}

// Search
let searchTimeout;
function handleSearch(query) {
  clearTimeout(searchTimeout);
  const resultsEl = document.getElementById('search-results');
  const gridEl = document.getElementById('search-results-grid');

  if (!query.trim()) {
    resultsEl.classList.add('hidden');
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const results = await API.searchMovies(query);
      if (results.length === 0) {
        gridEl.innerHTML = '<p class="col-span-full text-gray-500 text-sm py-4">No movies found for "' + query + '"</p>';
      } else {
        gridEl.innerHTML = results.map(m => renderMovieCard(m)).join('');
      }
      resultsEl.classList.remove('hidden');
    } catch (err) {
      gridEl.innerHTML = '<p class="col-span-full text-gray-500 text-sm">Search error</p>';
      resultsEl.classList.remove('hidden');
    }
  }, 300);
}

function filterByGenre(genre) {
  showPage('home');
  const rows = document.getElementById('movie-rows');
  const filtered = allMovies.filter(m => Array.isArray(m.genre) && m.genre.includes(genre));
  if (!filtered.length) return;
  rows.innerHTML = renderMovieRow(`${genre} Films`, filtered);

  // Add back button
  rows.insertAdjacentHTML('afterbegin', `
    <button onclick="renderHomePage()" class="mb-6 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
      ← All Categories
    </button>
  `);
}