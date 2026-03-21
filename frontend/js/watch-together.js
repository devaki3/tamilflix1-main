// Watch Together - Fully Fixed Version
let socket = null;
let currentRoom = null;
let currentUsername = '';
let isHost = false;
let ytPlayer = null;
let ytReady = false;

const BACKEND_URL = 'https://tamilflix1-main.onrender.com';

// Load YouTube IFrame API
function loadYouTubeAPI() {
  if (window.YT) return;
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

window.onYouTubeIframeAPIReady = function() {
  ytReady = true;
};

function initSocket() {
  if (socket && socket.connected) return;
  try {
    socket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 15000
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
      // Rejoin room if we were in one
      if (currentRoom) {
        const user = getUser();
        socket.emit('join-room', {
          roomCode: currentRoom.code,
          username: user?.name,
          token: API.getToken()
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      showToast('⚠️', 'Connection lost. Reconnecting...');
    });

    socket.on('reconnect', () => {
      showToast('✅', 'Reconnected!');
    });

    socket.on('room-update', ({ members, memberCount }) => {
      updateMembersList(members, memberCount);
    });

    socket.on('chat-message', (msg) => {
      appendChatMessage(msg);
    });

    socket.on('video-sync', ({ action, currentTime, isPlaying }) => {
      if (!ytPlayer || isHost) return;
      try {
        if (action === 'play') {
          ytPlayer.seekTo(currentTime || 0, true);
          ytPlayer.playVideo();
          showToast('▶', 'Host started the video');
        } else if (action === 'pause') {
          ytPlayer.pauseVideo();
          showToast('⏸', 'Host paused the video');
        } else if (action === 'seek') {
          ytPlayer.seekTo(currentTime, true);
        }
      } catch(e) { console.log('YT player error:', e); }
    });

    socket.on('error', ({ message }) => {
      showToast('❌', message);
    });

  } catch (e) {
    console.log('Socket.io error:', e.message);
  }
}

async function openWatchTogether(movieId) {
  showPage('watch-together');
  loadYouTubeAPI();
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

  currentUsername = user.name;

  content.innerHTML = `
    <div class="text-center mb-8">
      <div class="text-5xl mb-3">👥</div>
      <h1 class="text-3xl font-extrabold mb-2">Watch Together</h1>
      <p class="text-gray-400 text-sm">Watch Tamil movies with friends in real-time</p>
    </div>

    <div class="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
      <div class="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-red-600/30 transition-colors">
        <div class="text-3xl mb-3">🎬</div>
        <h3 class="text-lg font-bold mb-2">Create a Room</h3>
        <p class="text-gray-400 text-sm mb-5">Start a watch party and invite up to 8 friends</p>
        <button onclick="createRoom(${movieId || 'null'})"
          class="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all">
          Create Room
        </button>
      </div>

      <div class="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-red-600/30 transition-colors">
        <div class="text-3xl mb-3">🚪</div>
        <h3 class="text-lg font-bold mb-2">Join a Room</h3>
        <p class="text-gray-400 text-sm mb-4">Enter a room code to join your friends</p>
        <div class="flex gap-2">
          <input type="text" id="room-code-input" placeholder="Enter code..." maxlength="8"
            class="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white uppercase placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
            oninput="this.value = this.value.toUpperCase()"
            onkeypress="if(event.key==='Enter') joinRoom()">
          <button onclick="joinRoom()"
            class="bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-2.5 rounded-xl transition-all">
            Join
          </button>
        </div>
      </div>
    </div>

    <div class="text-center mt-6">
      <button onclick="showPage('home')" class="text-gray-500 hover:text-white text-sm transition-colors">← Back to Home</button>
    </div>
  `;
}

const LOCAL_ROOMS = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function createRoom(movieId) {
  const user = getUser();
  if (!user) { showToast('❌', 'Please login first'); return; }

  try {
    const data = await API.createRoom(movieId);
    if (data && !data.error) {
      let movie = null;
      if (movieId) { try { movie = await API.getMovie(movieId); } catch(e) {} }
      currentRoom = { code: data.roomCode, id: data.roomId, movieId };
      isHost = true;
      showToast('✅', `Room ${data.roomCode} created!`);
      renderWatchRoom(data.roomCode, movie, true);
      return;
    }
  } catch (err) {}

  // Fallback
  const roomCode = generateRoomCode();
  let movie = null;
  if (movieId) { try { movie = await API.getMovie(movieId); } catch(e) {} }

  LOCAL_ROOMS[roomCode] = {
    movieId, movie,
    members: [{ name: user.name, isHost: true }],
    hostName: user.name
  };

  currentRoom = { code: roomCode, movieId };
  isHost = true;
  showToast('✅', `Room ${roomCode} created!`);
  renderWatchRoom(roomCode, movie, true);
}

async function joinRoom() {
  const code = document.getElementById('room-code-input')?.value?.trim().toUpperCase();
  if (!code) { showToast('⚠️', 'Please enter a room code'); return; }

  const user = getUser();

  try {
    const data = await API.joinRoom(code);
    if (data && !data.error) {
      currentRoom = { code, id: data.roomId, movieId: data.movie?.id };
      isHost = data.isHost;
      renderWatchRoom(code, data.movie, data.isHost);
      return;
    }
  } catch (err) {}

  const localRoom = LOCAL_ROOMS[code];
  if (localRoom) {
    if (user && !localRoom.members.find(m => m.name === user.name)) {
      localRoom.members.push({ name: user.name, isHost: false });
    }
    currentRoom = { code, movieId: localRoom.movieId };
    isHost = false;
    renderWatchRoom(code, localRoom.movie, false);
    return;
  }

  showToast('❌', `Room "${code}" not found. Ask the host to share the correct code.`);
}

function getVideoId(trailerUrl) {
  if (!trailerUrl) return null;
  const embedMatch = trailerUrl.match(/embed\/([^?&]+)/);
  const shortMatch = trailerUrl.match(/youtu\.be\/([^?&]+)/);
  const longMatch = trailerUrl.match(/v=([^?&]+)/);
  if (embedMatch) return embedMatch[1];
  if (shortMatch) return shortMatch[1];
  if (longMatch) return longMatch[1];
  return null;
}

function renderWatchRoom(roomCode, movie, hostMode = false) {
  const content = document.getElementById('watch-together-content');
  const user = getUser();
  const userName = user?.name || 'You';

  const localRoom = LOCAL_ROOMS[roomCode];
  const members = localRoom ? localRoom.members.map(m => m.name) : [userName];
  const videoId = movie ? getVideoId(movie.trailer) : null;

  content.innerHTML = `
    <div class="mb-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-extrabold">🎬 Watch Room</h1>
        <div class="flex items-center gap-3 mt-1 flex-wrap">
          <div class="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm font-mono font-bold text-red-400">
            ${roomCode}
          </div>
          <button onclick="copyRoomCode('${roomCode}')" class="text-xs text-gray-500 hover:text-white transition-colors">
            📋 Copy Code
          </button>
          <span id="room-member-count" class="text-xs text-gray-500">${members.length}/8 members</span>
          ${hostMode ? '<span class="text-xs bg-red-600/20 text-red-400 border border-red-600/30 rounded px-2 py-0.5">👑 You are Host</span>' : '<span class="text-xs bg-white/10 text-gray-300 border border-white/20 rounded px-2 py-0.5">👤 Member</span>'}
        </div>
      </div>
      <button onclick="leaveRoom('${roomCode}')" class="text-sm text-gray-500 hover:text-red-400 transition-colors border border-white/10 px-3 py-1.5 rounded-lg">
        🚪 Leave Room
      </button>
    </div>

    <!-- Members List -->
    <div id="members-list" class="flex flex-wrap gap-2 mb-5">
      ${members.map(name => `
        <div class="member-pill">
          ${name === (localRoom?.hostName || userName) ? '👑 ' : ''}${name}
        </div>
      `).join('')}
    </div>

    <div class="grid lg:grid-cols-5 gap-5">
      <!-- Video Player -->
      <div class="lg:col-span-3">
        ${movie ? `
          <div class="mb-3">
            <h3 class="font-bold text-lg">${movie.title}
              <span class="text-sm text-gray-400 font-normal">${movie.year}</span>
            </h3>
          </div>
        ` : ''}

        ${videoId ? `
          <div id="yt-player-container" class="w-full rounded-xl overflow-hidden mb-4" style="aspect-ratio:16/9; background:#000;">
            <div id="yt-player"></div>
          </div>
        ` : `
          <div class="aspect-video bg-black/60 border border-white/10 rounded-xl flex flex-col items-center justify-center mb-4">
            <div class="text-5xl mb-3">🎬</div>
            <p class="text-gray-400 text-sm">${movie ? 'Trailer not available' : 'No movie selected'}</p>
            ${!movie ? `<button onclick="showPage('home')" class="mt-4 text-red-500 text-sm hover:text-red-400">Browse movies →</button>` : ''}
          </div>
        `}

        <!-- Controls -->
        <div class="flex gap-3 mt-2 flex-wrap">
          ${hostMode ? `
            <button onclick="hostPlay()" class="bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2">
              ▶ Play for All
            </button>
            <button onclick="hostPause()" class="bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2">
              ⏸ Pause for All
            </button>
            <span class="text-xs text-gray-500 flex items-center">👑 Host controls everyone</span>
          ` : `
            <div class="text-xs text-gray-500 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
              ⏳ Waiting for host to play...
            </div>
          `}
        </div>
      </div>

      <!-- Chat -->
      <div class="lg:col-span-2 flex flex-col bg-black/40 border border-white/10 rounded-xl overflow-hidden" style="height: 480px;">
        <div class="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span class="text-sm font-bold">💬 Live Chat</span>
          <span class="text-xs text-gray-500">${roomCode}</span>
        </div>

        <div id="chat-messages" class="chat-messages flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
          <div class="chat-bubble system">
            ${hostMode ? '🎉 Room created! Share code <strong>${roomCode}</strong> with friends' : `✅ You joined room ${roomCode}`}
          </div>
        </div>

        <div class="p-3 border-t border-white/10 flex gap-2">
          <input type="text" id="chat-input" placeholder="Type a message..." maxlength="200"
            class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
            onkeypress="if(event.key==='Enter') sendChatMessage('${roomCode}')">
          <button onclick="sendChatMessage('${roomCode}')"
            class="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg transition-all text-sm">
            Send
          </button>
        </div>
      </div>
    </div>
  `;

  // Initialize YouTube player
  if (videoId) {
    initYouTubePlayer(videoId, hostMode);
  }

  // Connect socket and join room
  initSocket();
  setTimeout(() => {
    if (socket && user) {
      socket.emit('join-room', {
        roomCode,
        username: user.name,
        token: API.getToken()
      });
    }
  }, 500);
}

function initYouTubePlayer(videoId, hostMode) {
  ytPlayer = null;

  function createPlayer() {
    if (!window.YT || !window.YT.Player) {
      setTimeout(createPlayer, 500);
      return;
    }

    const container = document.getElementById('yt-player');
    if (!container) return;

    ytPlayer = new YT.Player('yt-player', {
      width: '100%',
      height: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: hostMode ? 1 : 0, // only host has controls
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        origin: window.location.origin
      },
      events: {
        onReady: (e) => {
          console.log('YouTube player ready');
          // Style the container
          const iframe = document.querySelector('#yt-player iframe');
          if (iframe) {
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.borderRadius = '12px';
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

  createPlayer();
}

function hostPlay() {
  if (ytPlayer) {
    ytPlayer.playVideo();
  }
  if (socket && currentRoom) {
    socket.emit('video-control', {
      roomCode: currentRoom.code,
      action: 'play',
      currentTime: ytPlayer ? ytPlayer.getCurrentTime() : 0
    });
    showToast('▶', 'Playing for all members!');
  }
}

function hostPause() {
  if (ytPlayer) {
    ytPlayer.pauseVideo();
  }
  if (socket && currentRoom) {
    socket.emit('video-control', {
      roomCode: currentRoom.code,
      action: 'pause',
      currentTime: ytPlayer ? ytPlayer.getCurrentTime() : 0
    });
    showToast('⏸', 'Paused for all members!');
  }
}

function updateMembersList(members, memberCount) {
  const el = document.getElementById('members-list');
  if (!el || !members) return;
  el.innerHTML = members.map((name, i) => `
    <div class="member-pill">
      ${i === 0 ? '👑 ' : ''}${name}
    </div>
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
    div.textContent = msg.message;
  } else {
    div.innerHTML = `
      ${!isOwn ? `<div class="text-xs text-red-400 font-bold mb-1">${msg.username}</div>` : ''}
      <div>${escapeHtml(msg.message)}</div>
      <div class="text-xs text-gray-600 mt-1">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
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
    // Show locally if socket not connected
    const user = getUser();
    appendChatMessage({
      type: 'user',
      username: user?.name || 'You',
      message,
      timestamp: Date.now()
    });
  }

  input.value = '';
}

function copyRoomCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast('📋', `Room code ${code} copied! Share with friends!`);
  }).catch(() => {
    showToast('📋', `Room code: ${code}`);
  });
}

function leaveRoom(roomCode) {
  if (ytPlayer) {
    try { ytPlayer.destroy(); } catch(e) {}
    ytPlayer = null;
  }
  if (socket) {
    socket.emit('leave-room', { roomCode });
    socket.disconnect();
    socket = null;
  }
  currentRoom = null;
  isHost = false;
  showToast('👋', 'Left the room');
  showPage('home');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// Also fix syncVideo for backward compatibility
function syncVideo(action) {
  if (action === 'play') hostPlay();
  else if (action === 'pause') hostPause();
}
