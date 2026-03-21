// Watch Together - Fully Fixed Real Time Version
let socket = null;
let currentRoom = null;
let isHost = false;
let ytPlayer = null;
let ytApiLoaded = false;

const RENDER_URL = 'https://tamilflix1-main.onrender.com';

// Load YouTube API once
if (!window._ytApiLoading) {
  window._ytApiLoading = true;
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

window.onYouTubeIframeAPIReady = function() {
  ytApiLoaded = true;
  console.log('✅ YouTube API Ready');
};

// Initialize socket connection
function getSocket() {
  if (socket && socket.connected) return socket;

  socket = io(RENDER_URL, {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 20000,
    forceNew: false
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.log('Socket connect error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    showToast('⚠️', 'Connection lost. Reconnecting...');
  });

  socket.on('reconnect', () => {
    showToast('✅', 'Reconnected!');
    // Rejoin room if we were in one
    if (currentRoom) {
      const user = getUser();
      socket.emit('join-room', { roomCode: currentRoom.code, username: user?.name });
    }
  });

  // Room created
  socket.on('room-created', (data) => {
    console.log('Room created:', data);
    currentRoom = { code: data.roomCode, movie: data.movie };
    isHost = true;
    showToast('✅', `Room ${data.roomCode} created!`);
    renderWatchRoom(data.roomCode, data.movie, true, data.members, data.memberCount, data.roomCode);
  });

  // Room joined
  socket.on('room-joined', (data) => {
    console.log('Room joined:', data);
    currentRoom = { code: data.roomCode, movie: data.movie };
    isHost = data.isHost;
    showToast('✅', `Joined room ${data.roomCode}!`);
    renderWatchRoom(data.roomCode, data.movie, data.isHost, data.members, data.memberCount, data.hostName);
    // Sync video state
    if (data.videoState && data.videoState.currentTime > 0) {
      setTimeout(() => {
        if (ytPlayer && !data.videoState.isPlaying) {
          try { ytPlayer.seekTo(data.videoState.currentTime, true); } catch(e){}
        }
      }, 2000);
    }
  });

  // Room error
  socket.on('room-error', (data) => {
    console.log('Room error:', data);
    showToast('❌', data.message);
    const errEl = document.getElementById('join-error');
    const statusEl = document.getElementById('join-status');
    if (errEl) { errEl.textContent = data.message; errEl.classList.remove('hidden'); }
    if (statusEl) statusEl.classList.add('hidden');
    const createBtn = document.getElementById('create-room-btn');
    if (createBtn) { createBtn.disabled = false; createBtn.textContent = 'Create Room'; }
  });

  // Room members updated
  socket.on('room-update', (data) => {
    console.log('Room update:', data);
    updateMembersList(data.members, data.memberCount, data.hostName);
  });

  // Chat message received
  socket.on('chat-message', (msg) => {
    appendChatMessage(msg);
  });

  // Video sync for members
  socket.on('video-sync', ({ action, currentTime, isPlaying }) => {
    if (isHost) return;
    console.log('Video sync:', action, currentTime);
    if (!ytPlayer) return;
    try {
      if (action === 'play') {
        ytPlayer.seekTo(currentTime || 0, true);
        ytPlayer.playVideo();
        showToast('▶', 'Host played the video');
      } else if (action === 'pause') {
        ytPlayer.pauseVideo();
        showToast('⏸', 'Host paused the video');
      } else if (action === 'seek') {
        ytPlayer.seekTo(currentTime, true);
      }
    } catch(e) { console.log('YT sync error:', e); }
  });

  // Host transferred
  socket.on('host-transferred', ({ message }) => {
    isHost = true;
    showToast('👑', message);
    const hostControls = document.getElementById('host-controls');
    const memberMsg = document.getElementById('member-msg');
    if (hostControls) hostControls.classList.remove('hidden');
    if (memberMsg) memberMsg.classList.add('hidden');
    // Give host video controls
    if (ytPlayer) {
      try {
        const iframe = ytPlayer.getIframe();
        // Reload player with controls
      } catch(e) {}
    }
  });

  socket.on('error', ({ message }) => {
    showToast('❌', message);
  });

  return socket;
}

async function openWatchTogether(movieId) {
  showPage('watch-together');
  const content = document.getElementById('watch-together-content');

  const user = getUser();
  if (!user) {
    content.innerHTML = `
      <div class="text-center py-16">
        <div class="text-5xl mb-4">🔐</div>
        <h2 class="text-xl font-bold mb-2">Login Required</h2>
        <p class="text-gray-400 mb-6">You need to be logged in to use Watch Together</p>
        <button onclick="showPage('home')" class="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-xl">Go Home</button>
      </div>
    `;
    return;
  }

  // Pre-connect socket
  getSocket();

  // Get movie data
  let movie = null;
  if (movieId) {
    try { movie = await API.getMovie(movieId); } catch(e) {}
    if (!movie) movie = STATIC_MOVIES.find(m => m.id === parseInt(movieId)) || null;
  }

  content.innerHTML = `
    <div class="text-center mb-8">
      <div class="text-5xl mb-3">👥</div>
      <h1 class="text-3xl font-extrabold mb-2">Watch Together</h1>
      <p class="text-gray-400 text-sm">Watch Tamil movies with friends in real-time</p>
    </div>

    <div class="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
      <!-- Create Room -->
      <div class="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div class="text-3xl mb-3">🎬</div>
        <h3 class="text-lg font-bold mb-2">Create a Room</h3>
        <p class="text-gray-400 text-sm mb-2">${movie ? `Movie: <b class="text-white">${movie.title}</b>` : 'Browse and click Watch Together on a movie first'}</p>
        <p class="text-gray-500 text-xs mb-5">Up to 8 friends can join</p>
        <button id="create-room-btn" onclick="createRoom()"
          class="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all">
          Create Room
        </button>
        <p id="create-status" class="text-xs text-gray-500 mt-2 text-center hidden">Connecting to server...</p>
      </div>

      <!-- Join Room -->
      <div class="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div class="text-3xl mb-3">🚪</div>
        <h3 class="text-lg font-bold mb-2">Join a Room</h3>
        <p class="text-gray-400 text-sm mb-4">Enter the 6-letter code your friend shared</p>
        <div class="flex gap-2 mb-2">
          <input type="text" id="room-code-input" placeholder="ABC123" maxlength="8"
            class="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white uppercase placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors text-center tracking-widest font-mono text-lg"
            oninput="this.value=this.value.toUpperCase(); document.getElementById('join-error').classList.add('hidden')"
            onkeypress="if(event.key==='Enter') joinRoom()">
          <button onclick="joinRoom()"
            class="bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-2.5 rounded-xl transition-all">
            Join
          </button>
        </div>
        <p id="join-error" class="text-xs text-red-400 mt-1 hidden"></p>
        <p id="join-status" class="text-xs text-gray-500 mt-1 hidden">Joining room...</p>
      </div>
    </div>

    <div class="text-center mt-6">
      <button onclick="showPage('home')" class="text-gray-500 hover:text-white text-sm transition-colors">← Back to Home</button>
    </div>
  `;

  // Store movie for createRoom
  window._watchMovie = movie;
}

function createRoom() {
  const user = getUser();
  if (!user) { showToast('❌', 'Please login first'); return; }

  const btn = document.getElementById('create-room-btn');
  const status = document.getElementById('create-status');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
  if (status) status.classList.remove('hidden');

  const s = getSocket();
  s.emit('create-room', {
    username: user.name,
    movie: window._watchMovie || null
  });
}

function joinRoom() {
  const code = document.getElementById('room-code-input')?.value?.trim().toUpperCase();
  if (!code || code.length < 4) {
    showToast('⚠️', 'Please enter the room code');
    return;
  }

  const user = getUser();
  if (!user) { showToast('❌', 'Please login first'); return; }

  const status = document.getElementById('join-status');
  const errEl = document.getElementById('join-error');
  if (status) status.classList.remove('hidden');
  if (errEl) errEl.classList.add('hidden');

  const s = getSocket();
  s.emit('join-room', {
    roomCode: code,
    username: user.name
  });
}

function getVideoId(trailerUrl) {
  if (!trailerUrl) return null;
  const m1 = trailerUrl.match(/embed\/([^?&]+)/);
  const m2 = trailerUrl.match(/youtu\.be\/([^?&]+)/);
  const m3 = trailerUrl.match(/[?&]v=([^?&]+)/);
  return (m1 || m2 || m3)?.[1] || null;
}

function renderWatchRoom(roomCode, movie, hostMode, members, memberCount, hostName) {
  const content = document.getElementById('watch-together-content');
  const user = getUser();
  const videoId = movie ? getVideoId(movie.trailer) : null;
  const memberList = members || [user?.name || 'You'];

  content.innerHTML = `
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-extrabold">🎬 Watch Room</h1>
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          <span class="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm font-mono font-bold text-red-400 tracking-widest">${roomCode}</span>
          <button onclick="copyRoomCode('${roomCode}')" class="text-xs text-gray-400 hover:text-white bg-white/5 border border-white/10 px-2 py-1 rounded-lg transition-colors">📋 Copy</button>
          <span id="room-member-count" class="text-xs text-gray-500">${memberCount || memberList.length}/8 members</span>
          ${hostMode
            ? `<span class="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded px-2 py-0.5">👑 You are Host</span>`
            : `<span class="text-xs bg-white/10 text-gray-300 border border-white/20 rounded px-2 py-0.5">👤 Member</span>`
          }
        </div>
      </div>
      <button onclick="leaveRoom('${roomCode}')" class="text-sm text-gray-500 hover:text-red-400 border border-white/10 px-3 py-1.5 rounded-lg transition-colors">🚪 Leave</button>
    </div>

    <!-- Members -->
    <div id="members-list" class="flex flex-wrap gap-2 mb-5">
      ${memberList.map(name => `
        <div class="member-pill">${name === hostName ? '👑 ' : '👤 '}${name}</div>
      `).join('')}
    </div>

    <div class="grid lg:grid-cols-5 gap-5">
      <!-- Video -->
      <div class="lg:col-span-3">
        ${movie ? `<h3 class="font-bold text-lg mb-3">${movie.title} <span class="text-sm text-gray-400 font-normal">${movie.year}</span></h3>` : ''}

        ${videoId ? `
          <div class="w-full rounded-xl overflow-hidden mb-4 bg-black" style="aspect-ratio:16/9;">
            <div id="yt-player"></div>
          </div>
        ` : `
          <div class="aspect-video bg-black/60 border border-white/10 rounded-xl flex items-center justify-center mb-4">
            <div class="text-center">
              <div class="text-5xl mb-3">🎬</div>
              <p class="text-gray-400 text-sm">${movie ? 'Trailer not available' : 'No movie selected'}</p>
              ${!movie ? `<button onclick="showPage('home')" class="mt-3 text-red-500 text-sm">Browse movies →</button>` : ''}
            </div>
          </div>
        `}

        <!-- Controls -->
        <div id="host-controls" class="${hostMode ? '' : 'hidden'} flex gap-3 flex-wrap">
          <button onclick="hostPlay()" class="bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2">
            ▶ Play for Everyone
          </button>
          <button onclick="hostPause()" class="bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2">
            ⏸ Pause for Everyone
          </button>
        </div>
        <div id="member-msg" class="${hostMode ? 'hidden' : ''} text-xs text-gray-500 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
          ⏳ Waiting for host to start the video...
        </div>
      </div>

      <!-- Chat -->
      <div class="lg:col-span-2 flex flex-col bg-black/40 border border-white/10 rounded-xl overflow-hidden" style="height:480px;">
        <div class="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span class="text-sm font-bold">💬 Live Chat</span>
          <span class="text-xs text-gray-500">${roomCode}</span>
        </div>
        <div id="chat-messages" class="chat-messages flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
          <div class="chat-bubble system">
            ${hostMode ? `🎉 Room <b>${roomCode}</b> created! Share this code with friends` : `✅ You joined room <b>${roomCode}</b>`}
          </div>
        </div>
        <div class="p-3 border-t border-white/10 flex gap-2">
          <input type="text" id="chat-input" placeholder="Type a message..." maxlength="200"
            class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
            onkeypress="if(event.key==='Enter') sendChatMessage('${roomCode}')">
          <button onclick="sendChatMessage('${roomCode}')"
            class="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all">
            Send
          </button>
        </div>
      </div>
    </div>
  `;

  if (videoId) initYouTubePlayer(videoId, hostMode);
}

function initYouTubePlayer(videoId, hostMode) {
  ytPlayer = null;

  function tryCreate() {
    if (!window.YT || !window.YT.Player) { setTimeout(tryCreate, 300); return; }
    const el = document.getElementById('yt-player');
    if (!el) return;

    ytPlayer = new YT.Player('yt-player', {
      width: '100%',
      height: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: hostMode ? 1 : 0,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        fs: 1,
        origin: window.location.origin
      },
      events: {
        onReady: (e) => {
          console.log('YT player ready, host:', hostMode);
          const iframe = e.target.getIframe();
          if (iframe) {
            iframe.style.width = '100%';
            iframe.style.height = '100%';
          }
        },
        onStateChange: (e) => {
          if (!isHost || !socket || !currentRoom) return;
          if (e.data === YT.PlayerState.PLAYING) {
            socket.emit('video-control', {
              roomCode: currentRoom.code,
              action: 'play',
              currentTime: ytPlayer.getCurrentTime()
            });
          } else if (e.data === YT.PlayerState.PAUSED) {
            socket.emit('video-control', {
              roomCode: currentRoom.code,
              action: 'pause',
              currentTime: ytPlayer.getCurrentTime()
            });
          }
        }
      }
    });
  }

  tryCreate();
}

function hostPlay() {
  if (!isHost) return;
  const time = ytPlayer ? ytPlayer.getCurrentTime() : 0;
  if (ytPlayer) { try { ytPlayer.playVideo(); } catch(e) {} }
  if (socket && currentRoom) {
    socket.emit('video-control', { roomCode: currentRoom.code, action: 'play', currentTime: time });
    showToast('▶', 'Playing for everyone!');
  }
}

function hostPause() {
  if (!isHost) return;
  const time = ytPlayer ? ytPlayer.getCurrentTime() : 0;
  if (ytPlayer) { try { ytPlayer.pauseVideo(); } catch(e) {} }
  if (socket && currentRoom) {
    socket.emit('video-control', { roomCode: currentRoom.code, action: 'pause', currentTime: time });
    showToast('⏸', 'Paused for everyone!');
  }
}

function updateMembersList(members, memberCount, hostName) {
  const el = document.getElementById('members-list');
  if (!el || !members) return;
  el.innerHTML = members.map(name => `
    <div class="member-pill">${name === hostName ? '👑 ' : '👤 '}${name}</div>
  `).join('');
  const countEl = document.getElementById('room-member-count');
  if (countEl) countEl.textContent = `${memberCount || members.length}/8 members`;
}

function appendChatMessage(msg) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const user = getUser();
  const isOwn = msg.username === user?.name;
  const isSystem = msg.type === 'system';

  const div = document.createElement('div');
  div.className = `chat-bubble ${isSystem ? 'system' : isOwn ? 'own' : 'other'} slide-in`;

  if (isSystem) {
    div.innerHTML = msg.message;
  } else {
    div.innerHTML = `
      ${!isOwn ? `<div class="text-xs text-red-400 font-bold mb-1">${msg.username}</div>` : ''}
      <div>${escapeHtml(msg.message)}</div>
      <div class="text-xs opacity-40 mt-1">${new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
    `;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function sendChatMessage(roomCode) {
  const input = document.getElementById('chat-input');
  const message = input?.value?.trim();
  if (!message) return;

  if (socket && socket.connected) {
    socket.emit('send-message', { roomCode, message });
  } else {
    showToast('⚠️', 'Not connected! Trying to reconnect...');
    getSocket();
  }
  input.value = '';
}

function copyRoomCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast('📋', `Code ${code} copied! Share with friends!`);
  }).catch(() => {
    showToast('📋', `Room code: ${code}`);
  });
}

function leaveRoom(roomCode) {
  if (ytPlayer) { try { ytPlayer.destroy(); } catch(e) {} ytPlayer = null; }
  if (socket) {
    socket.emit('leave-room', { roomCode });
    socket.disconnect();
    socket = null;
  }
  currentRoom = null;
  isHost = false;
  window._watchMovie = null;
  showToast('👋', 'Left the room!');
  showPage('home');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function syncVideo(action) {
  if (action === 'play') hostPlay();
  else if (action === 'pause') hostPause();
}
