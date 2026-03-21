// Watch Together - Socket.io powered watch rooms
let socket = null;
let currentRoom = null;
let currentUsername = '';
let isHost = false;

const BACKEND_URL = 'https://tamilflix1-main.onrender.com';

function initSocket() {
  if (socket && socket.connected) return;
  try {
    socket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 3,
      timeout: 10000
    });

    socket.on('connect', () => console.log('🔌 Connected to socket'));
    socket.on('disconnect', () => console.log('❌ Socket disconnected'));

    socket.on('room-update', ({ members, memberCount }) => {
      updateMembersList(members);
      const countEl = document.getElementById('room-member-count');
      if (countEl) countEl.textContent = `${memberCount}/8 members`;
    });

    socket.on('chat-message', (msg) => {
      appendChatMessage(msg);
    });

    socket.on('video-sync', ({ action }) => {
      console.log('Video sync:', action);
    });

    socket.on('error', ({ message }) => {
      showToast('❌', message);
    });

  } catch (e) {
    console.log('Socket.io not available:', e.message);
  }
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

// Client-side room store
const LOCAL_ROOMS = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function createRoom(movieId) {
  try {
    const data = await API.createRoom(movieId);
    if (data && !data.error) {
      currentRoom = { code: data.roomCode, id: data.roomId, movieId };
      isHost = true;
      showToast('✅', `Room created! Code: ${data.roomCode}`);
      let movie = null;
      if (movieId) { try { movie = await API.getMovie(movieId); } catch(e) {} }
      renderWatchRoom(data.roomCode, movie, true);
      return;
    }
  } catch (err) {}

  // Fallback
  const roomCode = generateRoomCode();
  let movie = null;
  if (movieId) { try { movie = await API.getMovie(movieId); } catch(e) {} }

  const user = getUser();
  const hostName = user?.name || 'Host';
  LOCAL_ROOMS[roomCode] = { movieId, movie, members: [hostName] };

  currentRoom = { code: roomCode, movieId };
  isHost = true;
  showToast('✅', `Room created! Code: ${roomCode}`);
  renderWatchRoom(roomCode, movie, true);
}

async function joinRoom() {
  const code = document.getElementById('room-code-input')?.value?.trim().toUpperCase();
  if (!code) { showToast('⚠️', 'Please enter a room code'); return; }

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
    const user = getUser();
    if (user && !localRoom.members.includes(user.name)) {
      localRoom.members.push(user.name);
    }
    currentRoom = { code, movieId: localRoom.movieId };
    isHost = false;
    renderWatchRoom(code, localRoom.movie, false);
    return;
  }

  showToast('⚠️', `Room "${code}" not found. Creating guest session...`);
  currentRoom = { code, movieId: null };
  isHost = false;
  renderWatchRoom(code, null, false);
}

function buildWatchTrailer(trailerUrl, movieTitle) {
  if (!trailerUrl) return `
    <div class="aspect-video bg-black/60 border border-white/10 rounded-xl flex flex-col items-center justify-center mb-4">
      <div class="text-5xl mb-3">🎬</div>
      <p class="text-gray-400 text-sm">No trailer available</p>
    </div>
  `;

  // Extract YouTube video ID
  let videoId = '';
  const embedMatch = trailerUrl.match(/embed\/([^?&]+)/);
  const shortMatch = trailerUrl.match(/youtu\.be\/([^?&]+)/);
  const longMatch = trailerUrl.match(/v=([^?&]+)/);
  if (embedMatch) videoId = embedMatch[1];
  else if (shortMatch) videoId = shortMatch[1];
  else if (longMatch) videoId = longMatch[1];

  if (!videoId) return `<p class="text-gray-400 text-sm mb-4">Trailer not available</p>`;

  const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;

  return `
    <div class="trailer-thumb-container relative w-full rounded-xl overflow-hidden mb-4 cursor-pointer group"
      style="aspect-ratio:16/9; background:#000;"
      onclick="loadWatchTrailer(this, '${embedUrl}')">
      <img src="${thumbUrl}" alt="${movieTitle} trailer"
        class="w-full h-full object-cover transition-all duration-300 group-hover:scale-105 group-hover:brightness-75"
        onerror="this.src='https://img.youtube.com/vi/${videoId}/hqdefault.jpg'">
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="w-16 h-16 rounded-full bg-red-600/90 flex items-center justify-center shadow-2xl shadow-red-600/50 group-hover:scale-110 transition-transform">
          <span style="font-size:24px; margin-left:4px;">▶</span>
        </div>
      </div>
      <div class="absolute bottom-3 left-3 text-xs text-white/70 bg-black/50 px-2 py-1 rounded">
        🎬 ${movieTitle}
      </div>
    </div>
  `;
}

function loadWatchTrailer(container, embedUrl) {
  container.innerHTML = `
    <iframe src="${embedUrl}" class="w-full h-full" style="aspect-ratio:16/9;"
      frameborder="0" allowfullscreen
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
    </iframe>
  `;
}

function renderWatchRoom(roomCode, movie, hostMode = false) {
  const content = document.getElementById('watch-together-content');
  const user = getUser();
  const userName = user?.name || 'You';

  // Get all current members
  const localRoom = LOCAL_ROOMS[roomCode];
  const members = localRoom ? localRoom.members : [userName];

  content.innerHTML = `
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-extrabold">🎬 Watch Room</h1>
        <div class="flex items-center gap-3 mt-1">
          <div class="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm font-mono font-bold text-red-400">
            ${roomCode}
          </div>
          <button onclick="copyRoomCode('${roomCode}')" class="text-xs text-gray-500 hover:text-white transition-colors">
            📋 Copy Code
          </button>
          <span id="room-member-count" class="text-xs text-gray-500">${members.length}/8 members</span>
          ${hostMode ? '<span class="text-xs bg-red-600/20 text-red-400 border border-red-600/30 rounded px-2 py-0.5">👑 Host</span>' : ''}
        </div>
      </div>
      <button onclick="leaveRoom('${roomCode}')" class="text-sm text-gray-500 hover:text-red-400 transition-colors">
        Leave Room
      </button>
    </div>

    <!-- Members List -->
    <div id="members-list" class="flex flex-wrap gap-2 mb-5">
      ${members.map(name => `<div class="member-pill">${name}</div>`).join('')}
    </div>

    <div class="grid lg:grid-cols-5 gap-5">
      <!-- Video Player Area -->
      <div class="lg:col-span-3">
        ${movie ? `
          <div class="mb-3">
            <h3 class="font-bold text-lg">${movie.title} <span class="text-sm text-gray-400 font-normal">${movie.year}</span></h3>
          </div>
          ${buildWatchTrailer(movie.trailer, movie.title)}
        ` : `
          <div class="aspect-video bg-black/60 border border-white/10 rounded-xl flex flex-col items-center justify-center mb-4">
            <div class="text-5xl mb-3">🎬</div>
            <p class="text-gray-400 text-sm">No movie selected</p>
            <button onclick="showPage('home')" class="mt-4 text-red-500 text-sm hover:text-red-400 transition-colors">Browse movies →</button>
          </div>
        `}

        ${hostMode ? `
        <div class="flex gap-3 mt-2">
          <button onclick="syncVideo('play')" class="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all">▶ Play All</button>
          <button onclick="syncVideo('pause')" class="bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all">⏸ Pause All</button>
          <span class="text-xs text-gray-500 flex items-center">👑 Host controls</span>
        </div>
        ` : '<p class="text-xs text-gray-600 mt-2">Waiting for host to control playback...</p>'}
      </div>

      <!-- Chat -->
      <div class="lg:col-span-2 flex flex-col bg-black/40 border border-white/8 rounded-xl overflow-hidden" style="height: 450px;">
        <div class="px-4 py-3 border-b border-white/8 flex items-center justify-between">
          <span class="text-sm font-bold">💬 Live Chat</span>
          <span class="text-xs text-gray-500">Room: ${roomCode}</span>
        </div>

        <div id="chat-messages" class="chat-messages flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
          <div class="chat-bubble system">${hostMode ? '🎉 Room created! Share the code with friends' : '✅ You joined the room'}</div>
        </div>

        <div class="p-3 border-t border-white/8 flex gap-2">
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

  // Initialize socket and join room
  initSocket();
  if (socket && user) {
    socket.emit('join-room', {
      roomCode,
      username: user.name,
      token: API.getToken()
    });
  }
}

function updateMembersList(members) {
  const el = document.getElementById('members-list');
  if (!el || !members) return;
  el.innerHTML = members.map(name => `<div class="member-pill">${name}</div>`).join('');
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
    const user = getUser();
    appendChatMessage({ type: 'user', username: user?.name || 'You', message });
  }

  input.value = '';
}

function syncVideo(action) {
  if (socket && currentRoom) {
    socket.emit('video-control', { roomCode: currentRoom.code, action, currentTime: 0 });
    showToast('📡', `Syncing ${action} for all members`);
  } else {
    showToast('📡', `${action === 'play' ? '▶ Playing' : '⏸ Paused'}`);
  }
}

function copyRoomCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast('📋', `Room code ${code} copied!`);
  }).catch(() => {
    showToast('📋', `Room code: ${code}`);
  });
}

function leaveRoom(roomCode) {
  if (socket) {
    socket.emit('leave-room', { roomCode });
    socket.disconnect();
    socket = null;
  }
  currentRoom = null;
  showToast('👋', 'Left the room');
  showPage('home');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}
