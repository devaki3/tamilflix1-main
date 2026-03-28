// ============================================================
// Watch Together — Fixed: real-time chat, video sync, members,
//                         back navigation, socket reconnect
// ============================================================

let socket        = null;
let currentRoom   = null;
let currentUsername = '';
let isHost        = false;

// ── Page History (back navigation) ───────────────────────────
const _wtPageHistory = ['home'];

// Global goBack — called by every ← button across the app
window.goBack = function goBack() {
  if (_wtPageHistory.length > 1) {
    _wtPageHistory.pop();                              // remove current
    const prev = _wtPageHistory[_wtPageHistory.length - 1];
    if (typeof showPage === 'function') showPage(prev);
  } else {
    if (typeof showPage === 'function') showPage('home');
  }
};

// Intercept the global showPage (defined in app.js) to record history.
// Use a MutationObserver-style delayed hook so app.js has time to define it.
(function hookShowPage() {
  const maxTries = 20;
  let tries = 0;
  const interval = setInterval(() => {
    tries++;
    if (typeof window.showPage === 'function' && !window._wtHooked) {
      window._wtHooked    = true;
      const _orig         = window.showPage;
      window.showPage     = function(pageName, ...args) {
        _wtPageHistory.push(pageName);
        history.pushState({ page: pageName }, '', window.location.pathname);
        _orig(pageName, ...args);
      };
      clearInterval(interval);
    }
    if (tries >= maxTries) clearInterval(interval);
  }, 100);
})();

// Intercept browser back button → stay in SPA
window.addEventListener('popstate', () => {
  window.goBack();
});

// Push initial history entry
if (!history.state) {
  history.pushState({ page: 'home' }, '', window.location.pathname);
}

// ── Socket Setup ─────────────────────────────────────────────
const BACKEND_URL = 'https://tamilflix1-main.onrender.com';

function initSocket() {
  if (socket && socket.connected) return;

  try {
    socket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
      timeout: 15000
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
      // Re-join if we were in a room and reconnected
      if (currentRoom) {
        const user = getUser();
        socket.emit('join-room', {
          roomCode : currentRoom.code,
          username : user?.name || currentUsername,
          token    : API.getToken()
        });
      }
    });

    socket.on('disconnect', (reason) => console.log('❌ Disconnected:', reason));
    socket.on('connect_error', (err) => console.log('⚠ Socket error:', err.message));

    // Server tells this socket if it's host
    socket.on('host-status', ({ isHost: h }) => {
      isHost = h;
      _updateHostUI(h);
    });

    // Updated member list from server
    socket.on('room-update', ({ members, memberCount, hostSocketId }) => {
      _renderMembersList(members);
      const el = document.getElementById('room-member-count');
      if (el) el.textContent = `${memberCount}/8 members`;

      // Host transferred to us?
      if (socket && hostSocketId === socket.id && !isHost) {
        isHost = true;
        _updateHostUI(true);
        showToast('👑', 'You are now the host!');
      }
    });

    // Chat message broadcast to everyone in room
    socket.on('chat-message', (msg) => _appendChat(msg));

    // Video control from host → sync for members
    socket.on('video-sync', ({ action, currentTime, isPlaying }) => {
      _applyVideoSync(action, currentTime, isPlaying);
    });

    socket.on('error', ({ message }) => showToast('❌', message));

  } catch (e) {
    console.log('Socket.io unavailable:', e.message);
  }
}

// ── Video sync applier ────────────────────────────────────────
function _applyVideoSync(action, currentTime, isPlaying) {
  // Works with native <video id="watch-video-player">
  const v = document.getElementById('watch-video-player');
  if (v && v.tagName === 'VIDEO') {
    if (typeof currentTime === 'number' && Math.abs(v.currentTime - currentTime) > 1.5) {
      v.currentTime = currentTime;
    }
    if (action === 'play' || isPlaying) v.play().catch(() => {});
    else if (action === 'pause')         v.pause();
  } else {
    // YouTube embed — show notification
    if (action === 'play')  showToast('▶', 'Host started the video!');
    if (action === 'pause') showToast('⏸', 'Host paused the video');
    if (action === 'seek')  showToast('⏩', `Host skipped to ${Math.floor(currentTime || 0)}s`);
  }
}

// ── Toggle host/member UI ─────────────────────────────────────
function _updateHostUI(hostMode) {
  const hc    = document.getElementById('host-controls');
  const wm    = document.getElementById('member-waiting-msg');
  const badge = document.getElementById('host-badge');
  if (hc)    hc.style.display    = hostMode ? 'flex'         : 'none';
  if (wm)    wm.style.display    = hostMode ? 'none'         : 'block';
  if (badge) badge.style.display = hostMode ? 'inline-flex'  : 'none';
}

// ── Render member pills ───────────────────────────────────────
function _renderMembersList(members) {
  const el = document.getElementById('members-list');
  if (!el || !members) return;
  el.innerHTML = members
    .map(n => `<div class="member-pill">${_esc(n)}</div>`)
    .join('');
}

// ── Append a chat bubble ──────────────────────────────────────
function _appendChat(msg) {
  const box = document.getElementById('chat-messages');
  if (!box) return;

  const user     = getUser();
  const isOwn    = msg.username === user?.name;
  const isSystem = msg.type === 'system';

  const div = document.createElement('div');
  div.className = `chat-bubble ${isSystem ? 'system' : isOwn ? 'own' : 'other'} slide-in`;

  if (isSystem) {
    div.innerHTML = msg.message;
  } else {
    div.innerHTML = `
      ${!isOwn ? `<div class="text-xs text-red-400 font-bold mb-1">${_esc(msg.username)}</div>` : ''}
      <div>${_esc(msg.message)}</div>`;
  }

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// ── HTML escape ───────────────────────────────────────────────
function _esc(t) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(t)));
  return d.innerHTML;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

// Client-side room store (fallback when Render backend is cold/down)
const LOCAL_ROOMS = {};

function _genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── openWatchTogether ─────────────────────────────────────────
async function openWatchTogether(movieId) {
  showPage('watch-together');
  const content = document.getElementById('watch-together-content');
  const user    = getUser();

  if (!user) {
    content.innerHTML = `
      <div class="text-center py-16">
        <div class="text-5xl mb-4">🔐</div>
        <h2 class="text-xl font-bold mb-2">Login Required</h2>
        <p class="text-gray-400 mb-6">You need to be logged in to use Watch Together</p>
        <button onclick="showPage('home')"
          class="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-xl">Go Home</button>
      </div>`;
    return;
  }

  currentUsername = user.name;

  content.innerHTML = `
    <div class="text-center mb-8">
      <div class="text-5xl mb-3">👥</div>
      <h1 class="text-3xl font-extrabold mb-2">Watch Together</h1>
      <p class="text-gray-400 text-sm">Watch Tamil movies with friends in real-time</p>
    </div>

    <div class="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
      <!-- Create Room -->
      <div class="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-red-600/30 transition-colors">
        <div class="text-3xl mb-3">🎬</div>
        <h3 class="text-lg font-bold mb-2">Create a Room</h3>
        <p class="text-gray-400 text-sm mb-5">Start a watch party and invite up to 8 friends</p>
        <button onclick="createRoom(${movieId || 'null'})"
          class="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all">
          Create Room
        </button>
      </div>

      <!-- Join Room -->
      <div class="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-red-600/30 transition-colors">
        <div class="text-3xl mb-3">🚪</div>
        <h3 class="text-lg font-bold mb-2">Join a Room</h3>
        <p class="text-gray-400 text-sm mb-4">Enter a room code to join your friends</p>
        <div class="flex gap-2">
          <input type="text" id="room-code-input" placeholder="Enter code..." maxlength="8"
            class="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white uppercase placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
            oninput="this.value=this.value.toUpperCase()"
            onkeypress="if(event.key==='Enter') joinRoom()">
          <button onclick="joinRoom()"
            class="bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-2.5 rounded-xl transition-all">
            Join
          </button>
        </div>
      </div>
    </div>

    <div class="text-center mt-6">
      <button onclick="goBack()" class="text-gray-500 hover:text-white text-sm transition-colors">← Back</button>
    </div>`;
}

// ── createRoom ────────────────────────────────────────────────
async function createRoom(movieId) {
  showToast('⏳', 'Creating room...');
  let roomCode = null;
  let movie    = null;

  try {
    const data = await API.createRoom(movieId);
    if (data && !data.error) {
      roomCode    = data.roomCode;
      currentRoom = { code: roomCode, id: data.roomId, movieId };
      isHost      = true;
      if (movieId) { try { movie = await API.getMovie(movieId); } catch (_) {} }
    }
  } catch (_) {}

  // Fallback: local room (works when Render is cold-starting)
  if (!roomCode) {
    roomCode = _genCode();
    const user = getUser();
    LOCAL_ROOMS[roomCode] = { movieId, movie: null, members: [user?.name || 'Host'] };
    currentRoom = { code: roomCode, movieId };
    isHost      = true;
    if (movieId) { try { movie = await API.getMovie(movieId); } catch (_) {} }
    if (movie) LOCAL_ROOMS[roomCode].movie = movie;
  }

  showToast('✅', `Room created! Code: ${roomCode}`);
  renderWatchRoom(roomCode, movie, true);
}

// ── joinRoom ──────────────────────────────────────────────────
async function joinRoom() {
  const code = document.getElementById('room-code-input')?.value?.trim().toUpperCase();
  if (!code) { showToast('⚠️', 'Please enter a room code'); return; }

  showToast('⏳', 'Joining room...');

  try {
    const data = await API.joinRoom(code);
    if (data && !data.error) {
      currentRoom = { code, id: data.roomId, movieId: data.movie?.id };
      isHost      = data.isHost || false;
      renderWatchRoom(code, data.movie || null, isHost);
      return;
    }
  } catch (_) {}

  // Fallback: local room
  const lr = LOCAL_ROOMS[code];
  if (lr) {
    const user = getUser();
    if (user && !lr.members.includes(user.name)) lr.members.push(user.name);
    currentRoom = { code, movieId: lr.movieId };
    isHost      = false;
    renderWatchRoom(code, lr.movie, false);
    return;
  }

  showToast('⚠️', `Joining room ${code}...`);
  currentRoom = { code, movieId: null };
  isHost      = false;
  renderWatchRoom(code, null, false);
}

// ── Trailer HTML ──────────────────────────────────────────────
function _trailerHtml(trailerUrl, movieTitle) {
  if (!trailerUrl) return `
    <div class="aspect-video bg-black/60 border border-white/10 rounded-xl flex flex-col items-center justify-center mb-4">
      <div class="text-5xl mb-3">🎬</div><p class="text-gray-400 text-sm">No trailer available</p>
    </div>`;

  let vid = '';
  const em = trailerUrl.match(/embed\/([^?&]+)/);
  const sh = trailerUrl.match(/youtu\.be\/([^?&]+)/);
  const lo = trailerUrl.match(/v=([^?&]+)/);
  if (em) vid = em[1]; else if (sh) vid = sh[1]; else if (lo) vid = lo[1];
  if (!vid) return `<p class="text-gray-400 text-sm mb-4">Trailer not available</p>`;

  const thumb = `https://img.youtube.com/vi/${vid}/maxresdefault.jpg`;
  const embed = `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0&modestbranding=1`;

  return `
    <div class="trailer-thumb-container relative w-full rounded-xl overflow-hidden mb-4 cursor-pointer group"
      style="aspect-ratio:16/9;background:#000" onclick="loadWatchTrailer(this,'${embed}')">
      <img src="${thumb}" alt="${movieTitle} trailer"
        class="w-full h-full object-cover transition-all duration-300 group-hover:scale-105 group-hover:brightness-75"
        onerror="this.src='https://img.youtube.com/vi/${vid}/hqdefault.jpg'">
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="w-16 h-16 rounded-full bg-red-600/90 flex items-center justify-center shadow-2xl shadow-red-600/50 group-hover:scale-110 transition-transform">
          <span style="font-size:24px;margin-left:4px">▶</span>
        </div>
      </div>
      <div class="absolute bottom-3 left-3 text-xs text-white/70 bg-black/50 px-2 py-1 rounded">🎬 ${movieTitle}</div>
    </div>`;
}

function loadWatchTrailer(container, embedUrl) {
  container.innerHTML = `
    <iframe src="${embedUrl}" class="w-full h-full" style="aspect-ratio:16/9"
      frameborder="0" allowfullscreen
      allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture">
    </iframe>`;
}

// ── renderWatchRoom ───────────────────────────────────────────
function renderWatchRoom(roomCode, movie, hostMode = false) {
  const content  = document.getElementById('watch-together-content');
  const user     = getUser();
  const userName = user?.name || 'You';
  const lr       = LOCAL_ROOMS[roomCode];
  const members  = lr ? lr.members : [userName];

  content.innerHTML = `
    <div class="mb-6 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-extrabold">🎬 Watch Room</h1>
        <div class="flex items-center gap-3 mt-1 flex-wrap">
          <div class="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm font-mono font-bold text-red-400">${roomCode}</div>
          <button onclick="copyRoomCode('${roomCode}')" class="text-xs text-gray-500 hover:text-white transition-colors">📋 Copy Code</button>
          <span id="room-member-count" class="text-xs text-gray-500">${members.length}/8 members</span>
          <span id="host-badge" class="text-xs bg-red-600/20 text-red-400 border border-red-600/30 rounded px-2 py-0.5"
            style="display:${hostMode ? 'inline-flex' : 'none'}">👑 Host</span>
        </div>
      </div>
      <button onclick="leaveRoom('${roomCode}')" class="text-sm text-gray-500 hover:text-red-400 transition-colors">Leave Room</button>
    </div>

    <!-- Members -->
    <div id="members-list" class="flex flex-wrap gap-2 mb-5">
      ${members.map(n => `<div class="member-pill">${_esc(n)}</div>`).join('')}
    </div>

    <div class="grid lg:grid-cols-5 gap-5">
      <!-- Video -->
      <div class="lg:col-span-3">
        ${movie ? `
          <div class="mb-3"><h3 class="font-bold text-lg">${movie.title}
            <span class="text-sm text-gray-400 font-normal">${movie.year}</span></h3></div>
          ${_trailerHtml(movie.trailer, movie.title)}
        ` : `
          <div class="aspect-video bg-black/60 border border-white/10 rounded-xl flex flex-col items-center justify-center mb-4">
            <div class="text-5xl mb-3">🎬</div>
            <p class="text-gray-400 text-sm">No movie selected</p>
            <button onclick="showPage('home')" class="mt-4 text-red-500 text-sm hover:text-red-400 transition-colors">Browse movies →</button>
          </div>`}

        <!-- Host controls -->
        <div id="host-controls" class="flex gap-3 mt-2" style="display:${hostMode ? 'flex' : 'none'}">
          <button onclick="syncVideo('play')"
            class="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all">▶ Play All</button>
          <button onclick="syncVideo('pause')"
            class="bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all">⏸ Pause All</button>
          <span class="text-xs text-gray-500 flex items-center">👑 Host controls</span>
        </div>
        <p id="member-waiting-msg" class="text-xs text-gray-600 mt-2"
          style="display:${hostMode ? 'none' : 'block'}">Waiting for host to control playback...</p>
      </div>

      <!-- Chat -->
      <div class="lg:col-span-2 flex flex-col bg-black/40 border border-white/8 rounded-xl overflow-hidden" style="height:450px">
        <div class="px-4 py-3 border-b border-white/8 flex items-center justify-between">
          <span class="text-sm font-bold">💬 Live Chat</span>
          <span class="text-xs text-gray-500">Room: ${roomCode}</span>
        </div>
        <div id="chat-messages" class="chat-messages flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
          <div class="chat-bubble system">
            ${hostMode
              ? `🎉 Room created! Share code: <strong>${roomCode}</strong>`
              : '✅ You joined the room'}
          </div>
        </div>
        <div class="p-3 border-t border-white/8 flex gap-2">
          <input type="text" id="chat-input" placeholder="Type a message..." maxlength="200"
            class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
            onkeypress="if(event.key==='Enter') sendChatMessage('${roomCode}')">
          <button onclick="sendChatMessage('${roomCode}')"
            class="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg transition-all text-sm">Send</button>
        </div>
      </div>
    </div>`;

  // Connect socket and announce presence
  initSocket();
  setTimeout(() => {
    if (socket) {
      socket.emit('join-room', {
        roomCode,
        username : user?.name || currentUsername,
        token    : API.getToken()
      });
    }
  }, 500); // small delay so socket.on handlers are registered first
}

// ── Public helpers ────────────────────────────────────────────

// Exported so sparkles.js / other files can call it
function updateMembersList(members) { _renderMembersList(members); }
function appendChatMessage(msg)     { _appendChat(msg); }

function sendChatMessage(roomCode) {
  const input   = document.getElementById('chat-input');
  const message = input?.value?.trim();
  if (!message) return;

  if (socket && socket.connected) {
    // Server will broadcast back to everyone including sender — do NOT append locally
    socket.emit('send-message', { roomCode, message });
  } else {
    // Offline fallback
    const user = getUser();
    _appendChat({ type: 'user', username: user?.name || 'You', message });
  }

  input.value = '';
  input.focus();
}

function syncVideo(action) {
  if (!isHost) { showToast('⚠️', 'Only the host can control playback'); return; }
  if (socket && socket.connected && currentRoom) {
    socket.emit('video-control', { roomCode: currentRoom.code, action, currentTime: 0 });
    showToast('📡', `Syncing ${action} for all members`);
  } else {
    showToast('📡', `${action === 'play' ? '▶ Playing' : '⏸ Paused'}`);
  }
}

function copyRoomCode(code) {
  const txt = `Join my Watch Party on PadamPaapoma! Room Code: ${code}`;
  navigator.clipboard.writeText(txt)
    .then(()  => showToast('📋', `Room code ${code} copied!`))
    .catch(()  => showToast('📋', `Room code: ${code}`));
}

function leaveRoom(roomCode) {
  if (socket) {
    socket.emit('leave-room', { roomCode });
    socket.off('room-update');
    socket.off('chat-message');
    socket.off('video-sync');
    socket.off('host-status');
    socket.disconnect();
    socket = null;
  }
  currentRoom = null;
  isHost      = false;
  showToast('👋', 'Left the room');
  window.goBack();
}
