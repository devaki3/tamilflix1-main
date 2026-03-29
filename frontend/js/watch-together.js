// ============================================================
// Watch Together — Definitive Fix
// Chat: UNCHANGED (working perfectly)
// Fixed: video sync, host control, room close, join visibility
// ============================================================

let socket          = null;
let currentRoom     = null;
let currentUsername = '';
let isHost          = false;
let ytPlayer        = null;
let isSyncing       = false;
let _pendingSync    = null;

// ── Page History ──────────────────────────────────────────────
const _wtPageHistory = ['home'];

window.goBack = function () {
  if (_wtPageHistory.length > 1) {
    _wtPageHistory.pop();
    const prev = _wtPageHistory[_wtPageHistory.length - 1];
    if (typeof showPage === 'function') showPage(prev);
  } else {
    if (typeof showPage === 'function') showPage('home');
  }
};

(function hookShowPage() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if (typeof window.showPage === 'function' && !window._wtHooked) {
      window._wtHooked  = true;
      const _orig       = window.showPage;
      window.showPage   = function (p, ...a) {
        _wtPageHistory.push(p);
        history.pushState({ page: p }, '', window.location.pathname);
        _orig(p, ...a);
      };
      clearInterval(iv);
    }
    if (tries >= 20) clearInterval(iv);
  }, 100);
})();

window.addEventListener('popstate', () => window.goBack());
if (!history.state) history.pushState({ page: 'home' }, '', window.location.pathname);

// ── YouTube IFrame API ────────────────────────────────────────
function _loadYTApi() {
  if (document.getElementById('yt-api-script')) return;
  const s   = document.createElement('script');
  s.id      = 'yt-api-script';
  s.src     = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(s);
}

window.onYouTubeIframeAPIReady = function () {
  window._ytApiReady = true;
  console.log('✅ YouTube IFrame API ready');
};

function _createPlayer(videoId) {
  if (!window.YT || !window.YT.Player) {
    setTimeout(() => _createPlayer(videoId), 500);
    return;
  }
  if (!document.getElementById('yt-player')) return;

  console.log('🎬 Creating YT player, videoId:', videoId, 'isHost:', isHost);

  ytPlayer = new YT.Player('yt-player', {
    videoId,
    width  : '100%',
    height : '100%',
    playerVars: {
      autoplay       : 0,
      rel            : 0,
      modestbranding : 1,
      enablejsapi    : 1,
      origin         : window.location.origin,
      controls       : 1,
      disablekb      : 0,
    },
    events: {
      onReady       : _onPlayerReady,
      onStateChange : _onPlayerStateChange
    }
  });
}

function _onPlayerReady() {
  console.log('✅ YT player ready | isHost:', isHost);
  if (_pendingSync) {
    console.log('📺 Applying pending sync:', _pendingSync);
    _applySync(_pendingSync.action, _pendingSync.currentTime);
    _pendingSync = null;
  }
  _refreshOverlay();
}

function _onPlayerStateChange(e) {
  if (!isHost) return;
  if (isSyncing) return;
  const t = ytPlayer.getCurrentTime();
  if (e.data === YT.PlayerState.PLAYING) {
    _emitControl('play', t);
  } else if (e.data === YT.PlayerState.PAUSED) {
    _emitControl('pause', t);
  }
}

function _applySync(action, currentTime) {
  if (!ytPlayer || typeof ytPlayer.playVideo !== 'function') {
    _pendingSync = { action, currentTime };
    console.log('⏳ Player not ready, queuing sync:', action);
    return;
  }

  isSyncing = true;
  console.log('📺 Applying sync:', action, 'at', Math.floor(currentTime || 0) + 's');

  try {
    if (typeof currentTime === 'number') {
      const diff = Math.abs(ytPlayer.getCurrentTime() - currentTime);
      if (diff > 2) ytPlayer.seekTo(currentTime, true);
    }
    if (action === 'play')  ytPlayer.playVideo();
    if (action === 'pause') ytPlayer.pauseVideo();
    if (action === 'seek')  ytPlayer.seekTo(currentTime, true);
  } catch (err) {
    console.warn('_applySync error:', err.message);
  }

  setTimeout(() => { isSyncing = false; }, 1500);
}

function _emitControl(action, currentTime) {
  if (socket && socket.connected && currentRoom) {
    socket.emit('video-control', {
      roomCode    : currentRoom.code,
      action,
      currentTime : currentTime || 0
    });
    console.log('📡 Emitting video-control:', action, 'at', Math.floor(currentTime || 0) + 's');
  }
}

function _refreshOverlay() {
  const ov = document.getElementById('yt-overlay');
  const lb = document.getElementById('yt-lock-badge');
  if (ov) ov.style.display = isHost ? 'none'  : 'block';
  if (lb) lb.style.display = isHost ? 'none'  : 'block';
}

// ── Socket ────────────────────────────────────────────────────
const BACKEND_URL = 'https://tamilflix1-main.onrender.com';

function initSocket() {
  if (socket && socket.connected) return;

  try {
    socket = io(BACKEND_URL, {
      transports          : ['polling', 'websocket'],
      reconnection        : true,
      reconnectionAttempts: 5,
      reconnectionDelay   : 1500,
      timeout             : 15000
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
      if (currentRoom) {
        const u = getUser();
        socket.emit('join-room', {
          roomCode : currentRoom.code,
          username : u?.name || currentUsername,
          token    : API.getToken()
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    socket.on('host-status', ({ isHost: h }) => {
      isHost = h;
      _updateHostUI(h);
      _refreshOverlay();
      console.log('👑 Host status:', h);
    });

    socket.on('room-update', ({ members, memberCount, hostSocketId }) => {
      _renderMembers(members);
      const el = document.getElementById('room-member-count');
      if (el) el.textContent = `${memberCount}/8 members`;

      if (socket && hostSocketId === socket.id && !isHost) {
        isHost = true;
        _updateHostUI(true);
        _refreshOverlay();
        showToast('👑', 'You are now the host!');
      }
    });

    socket.on('chat-message', _appendChat);

    socket.on('video-sync', ({ action, currentTime, isPlaying }) => {
      const a = action || (isPlaying ? 'play' : 'pause');
      console.log('📺 video-sync received:', a, currentTime);
      _applySync(a, currentTime);
      if (!isHost) {
        if (a === 'play')  showToast('▶', 'Host started the video!');
        if (a === 'pause') showToast('⏸', 'Host paused the video');
        if (a === 'seek')  showToast('⏩', `Host seeked to ${Math.floor(currentTime || 0)}s`);
      }
    });

    socket.on('room-closed', ({ reason } = {}) => {
      showToast('🚪', reason || 'Host closed the room.');
      _exitCleanup();
    });

    socket.on('error', ({ message }) => showToast('❌', message));

  } catch (e) {
    console.warn('Socket unavailable:', e.message);
  }
}

// ── UI Helpers ────────────────────────────────────────────────
function _updateHostUI(hostMode) {
  const hc    = document.getElementById('host-controls');
  const wm    = document.getElementById('member-waiting-msg');
  const badge = document.getElementById('host-badge');
  if (hc)    hc.style.display    = hostMode ? 'flex'        : 'none';
  if (wm)    wm.style.display    = hostMode ? 'none'        : 'block';
  if (badge) badge.style.display = hostMode ? 'inline-flex' : 'none';
}

function _renderMembers(members) {
  const el = document.getElementById('members-list');
  if (!el || !members) return;
  el.innerHTML = members
    .map(n => `<div class="member-pill">${_esc(n)}</div>`)
    .join('');
}

function _appendChat(msg) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const user     = getUser();
  const isOwn    = msg.username === user?.name;
  const isSystem = msg.type === 'system';
  const div      = document.createElement('div');
  div.className  = `chat-bubble ${isSystem ? 'system' : isOwn ? 'own' : 'other'} slide-in`;
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

function _esc(t) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(t)));
  return d.innerHTML;
}

function _extractVideoId(url) {
  if (!url) return null;
  return (
    (url.match(/embed\/([^?&\s]+)/)      ||
     url.match(/youtu\.be\/([^?&\s]+)/)  ||
     url.match(/v=([^?&\s]+)/)           || [])[1] || null
  );
}

function _exitCleanup() {
  ytPlayer     = null;
  _pendingSync = null;
  currentRoom  = null;
  isHost       = false;
  if (socket) {
    ['room-update','chat-message','video-sync','host-status','room-closed']
      .forEach(ev => socket.off(ev));
    socket.disconnect();
    socket = null;
  }
  window.goBack();
}

// ── Local fallback store ──────────────────────────────────────
const LOCAL_ROOMS = {};
const _genCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// ── openWatchTogether ─────────────────────────────────────────
async function openWatchTogether(movieId) {
  showPage('watch-together');
  _loadYTApi();

  const content = document.getElementById('watch-together-content');
  const user    = getUser();

  if (!user) {
    content.innerHTML = `
      <div class="text-center py-16">
        <div class="text-5xl mb-4">🔐</div>
        <h2 class="text-xl font-bold mb-2">Login Required</h2>
        <p class="text-gray-400 mb-6">You need to be logged in to use Watch Together</p>
        <button onclick="showPage('home')"
          class="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-xl">
          Go Home
        </button>
      </div>`;
    return;
  }
  currentUsername = user.name;

  content.innerHTML = `
    <div class="text-center mb-8">
      <div class="text-5xl mb-3">👥</div>
      <h1 class="text-3xl font-extrabold mb-2">Watch Together</h1>
      <p class="text-gray-400 text-sm">Watch Tamil movies with friends in real-time — up to 8 people</p>
    </div>

    <div class="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">

      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:28px;">
        <div style="font-size:36px;margin-bottom:12px;">🎬</div>
        <h3 style="font-size:17px;font-weight:800;margin-bottom:6px;">Create a Room</h3>
        <p style="color:#9ca3af;font-size:13px;margin-bottom:20px;">
          Start a watch party. You become the host and control playback for everyone.
        </p>
        <button onclick="createRoom(${movieId || 'null'})"
          style="width:100%;background:#dc2626;color:#fff;font-weight:700;padding:12px;border-radius:12px;border:none;cursor:pointer;font-size:14px;"
          onmouseover="this.style.background='#b91c1c'" onmouseout="this.style.background='#dc2626'">
          🚀 Create Room
        </button>
      </div>

      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:28px;">
        <div style="font-size:36px;margin-bottom:12px;">🚪</div>
        <h3 style="font-size:17px;font-weight:800;margin-bottom:6px;">Join a Room</h3>
        <p style="color:#9ca3af;font-size:13px;margin-bottom:16px;">
          Have a room code? Enter it below to join your friend's watch party.
        </p>
        <div style="display:flex;gap:8px;">
          <input type="text" id="room-code-input" placeholder="Enter code e.g. ABC123" maxlength="8"
            style="flex:1;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.12);border-radius:10px;
              padding:10px 14px;font-size:13px;color:#fff;outline:none;text-transform:uppercase;letter-spacing:2px;"
            oninput="this.value=this.value.toUpperCase()"
            onkeypress="if(event.key==='Enter') joinRoom()">
          <button onclick="joinRoom()"
            style="background:rgba(255,255,255,0.1);color:#fff;font-weight:700;padding:10px 18px;border-radius:10px;border:none;cursor:pointer;font-size:13px;white-space:nowrap;"
            onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
            Join →
          </button>
        </div>
      </div>

    </div>

    <div class="text-center mt-8">
      <button onclick="goBack()"
        style="color:#6b7280;font-size:13px;background:none;border:none;cursor:pointer;"
        onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#6b7280'">
        ← Back
      </button>
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

  if (!roomCode) {
    roomCode = _genCode();
    const u  = getUser();
    LOCAL_ROOMS[roomCode] = { movieId, movie: null, members: [u?.name || 'Host'] };
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

  const lr = LOCAL_ROOMS[code];
  if (lr) {
    const u = getUser();
    if (u && !lr.members.includes(u.name)) lr.members.push(u.name);
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

// ── renderWatchRoom ───────────────────────────────────────────
function renderWatchRoom(roomCode, movie, hostMode = false) {
  ytPlayer     = null;
  _pendingSync = null;
  _loadYTApi();

  const content  = document.getElementById('watch-together-content');
  const user     = getUser();
  const userName = user?.name || 'You';
  const lr       = LOCAL_ROOMS[roomCode];
  const members  = lr ? lr.members : [userName];
  const videoId  = movie ? _extractVideoId(movie.trailer) : null;

  content.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
      <div>
        <h1 style="font-size:20px;font-weight:900;margin:0;">🎬 Watch Room</h1>
        <div style="display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap;">
          <span style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:3px 14px;font-family:monospace;font-weight:700;color:#f87171;font-size:15px;letter-spacing:2px;">${roomCode}</span>
          <button onclick="copyRoomCode('${roomCode}')" style="font-size:11px;color:#6b7280;background:none;border:none;cursor:pointer;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#6b7280'">📋 Copy Code</button>
          <span id="room-member-count" style="font-size:12px;color:#6b7280;">${members.length}/8 members</span>
          <span id="host-badge" style="font-size:11px;background:rgba(220,38,38,0.15);color:#f87171;border:1px solid rgba(220,38,38,0.3);border-radius:6px;padding:2px 10px;display:${hostMode ? 'inline-flex' : 'none'}">👑 Host</span>
        </div>
      </div>
      <button onclick="leaveRoom('${roomCode}')"
        style="flex-shrink:0;background:rgba(220,38,38,0.12);border:1px solid rgba(220,38,38,0.35);color:#f87171;padding:9px 18px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;"
        onmouseover="this.style.background='rgba(220,38,38,0.28)'" onmouseout="this.style.background='rgba(220,38,38,0.12)'">
        🚪 Leave Room
      </button>
    </div>

    <div id="members-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
      ${members.map(n => `<div class="member-pill">${_esc(n)}</div>`).join('')}
    </div>

    <div class="grid lg:grid-cols-5 gap-5">

      <div class="lg:col-span-3">
        ${movie ? `<p style="font-weight:700;margin-bottom:8px;font-size:15px;">${movie.title} <span style="font-size:12px;color:#9ca3af;font-weight:400;">${movie.year}</span></p>` : ''}

        ${videoId ? `
          <div style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;margin-bottom:12px;">
            <div id="yt-player" style="position:absolute;inset:0;width:100%;height:100%;"></div>
            <div id="yt-overlay" style="position:absolute;inset:0;z-index:10;cursor:not-allowed;display:${hostMode ? 'none' : 'block'};"></div>
            <div id="yt-lock-badge" style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#9ca3af;font-size:11px;padding:4px 14px;border-radius:20px;z-index:11;pointer-events:none;white-space:nowrap;display:${hostMode ? 'none' : 'block'};">
              🔒 Only host controls playback
            </div>
          </div>
        ` : `
          <div style="width:100%;aspect-ratio:16/9;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;margin-bottom:12px;">
            <div style="font-size:48px;margin-bottom:12px;">🎬</div>
            <p style="color:#9ca3af;font-size:13px;">${movie ? 'No trailer available' : 'No movie selected'}</p>
            ${!movie ? `<button onclick="showPage('home')" style="margin-top:12px;color:#ef4444;font-size:13px;background:none;border:none;cursor:pointer;">Browse movies →</button>` : ''}
          </div>`}

        <div id="host-controls" style="display:${hostMode ? 'flex' : 'none'};gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
          <button onclick="syncVideo('play')"
            style="background:#16a34a;color:#fff;font-size:13px;font-weight:700;padding:9px 18px;border-radius:9px;border:none;cursor:pointer;"
            onmouseover="this.style.background='#15803d'" onmouseout="this.style.background='#16a34a'">
            ▶ Play for Everyone
          </button>
          <button onclick="syncVideo('pause')"
            style="background:#ca8a04;color:#fff;font-size:13px;font-weight:700;padding:9px 18px;border-radius:9px;border:none;cursor:pointer;"
            onmouseover="this.style.background='#a16207'" onmouseout="this.style.background='#ca8a04'">
            ⏸ Pause for Everyone
          </button>
          <span style="font-size:11px;color:#6b7280;">👑 You control playback</span>
        </div>

        <p id="member-waiting-msg" style="font-size:12px;color:#4b5563;display:${hostMode ? 'none' : 'block'};margin-top:4px;">
          ⏳ Waiting for host to start the video…
        </p>
      </div>

      <div class="lg:col-span-2" style="display:flex;flex-direction:column;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;height:460px;">
        <div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;font-weight:700;">💬 Live Chat</span>
          <span style="font-size:11px;color:#6b7280;">Room: ${roomCode}</span>
        </div>
        <div id="chat-messages" class="chat-messages" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;">
          <div class="chat-bubble system">
            ${hostMode ? `🎉 Room created! Share the code: <strong>${roomCode}</strong>` : '✅ You joined the room'}
          </div>
        </div>
        <div style="padding:10px;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:8px;">
          <input type="text" id="chat-input" placeholder="Type a message…" maxlength="200"
            style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:9px 12px;font-size:13px;color:#fff;outline:none;"
            onkeypress="if(event.key==='Enter') sendChatMessage('${roomCode}')">
          <button onclick="sendChatMessage('${roomCode}')"
            style="background:#dc2626;color:#fff;font-weight:700;padding:9px 16px;border-radius:8px;font-size:13px;border:none;cursor:pointer;white-space:nowrap;"
            onmouseover="this.style.background='#b91c1c'" onmouseout="this.style.background='#dc2626'">
            Send
          </button>
        </div>
      </div>

    </div>`;

  initSocket();
  setTimeout(() => {
    if (socket) {
      socket.emit('join-room', {
        roomCode,
        username : user?.name || currentUsername,
        token    : API.getToken()
      });
    }
    if (videoId) _createPlayer(videoId);
  }, 300);
}

// ── Public functions ──────────────────────────────────────────
function updateMembersList(members) { _renderMembers(members); }
function appendChatMessage(msg)     { _appendChat(msg); }

function sendChatMessage(roomCode) {
  const input   = document.getElementById('chat-input');
  const message = input?.value?.trim();
  if (!message) return;
  if (socket && socket.connected) {
    socket.emit('send-message', { roomCode, message });
  } else {
    const u = getUser();
    _appendChat({ type: 'user', username: u?.name || 'You', message });
  }
  input.value = '';
  input.focus();
}

function syncVideo(action) {
  if (!isHost) { showToast('⚠️', 'Only the host can control playback'); return; }
  const t = (ytPlayer && typeof ytPlayer.getCurrentTime === 'function')
    ? ytPlayer.getCurrentTime() : 0;
  _emitControl(action, t);
  _applySync(action, t);
  showToast('📡', `${action === 'play' ? '▶ Playing' : '⏸ Paused'} for everyone`);
}

function copyRoomCode(code) {
  navigator.clipboard.writeText(`Join my Watch Party on PadamPaapoma! Room Code: ${code}`)
    .then(() => showToast('📋', `Code ${code} copied!`))
    .catch(() => showToast('📋', `Room code: ${code}`));
}

function leaveRoom(roomCode) {
  if (socket && socket.connected) {
    if (isHost) {
      socket.emit('close
