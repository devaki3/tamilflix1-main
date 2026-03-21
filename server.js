require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

const { initializeDatabase } = require('./database/init');
const { router: authRouter, setDb: setAuthDb } = require('./auth');
const { router: moviesRouter, setDb: setMoviesDb } = require('./movies');
const { router: roomsRouter, setDb: setRoomsDb } = require('./rooms');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket']
});

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

const db = initializeDatabase();
setAuthDb(db);
setMoviesDb(db);
setRoomsDb(db);

app.use('/api/auth', authRouter);
app.use('/api/movies', moviesRouter);
app.use('/api/rooms', roomsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '🎬 TamilFlix API is running!', rooms: ROOMS.size });
});

app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT id, name, email, is_verified, created_at FROM users').all();
  res.json(users);
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'frontend/index.html'));
  }
});

// In-memory rooms store
// roomCode -> { members: [{socketId, username}], movie, videoState, hostSocketId }
const ROOMS = new Map();

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  // CREATE ROOM
  socket.on('create-room', ({ username, movie }) => {
    const roomCode = generateCode();

    ROOMS.set(roomCode, {
      members: [{ socketId: socket.id, username }],
      movie: movie || null,
      videoState: { isPlaying: false, currentTime: 0 },
      hostSocketId: socket.id,
      hostName: username
    });

    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.username = username;

    socket.emit('room-created', {
      roomCode,
      members: [username],
      memberCount: 1,
      movie: movie || null,
      isHost: true
    });

    console.log(`🏠 Room ${roomCode} created by ${username}`);
  });

  // JOIN ROOM
  socket.on('join-room', ({ roomCode, username }) => {
    const room = ROOMS.get(roomCode);

    if (!room) {
      socket.emit('room-error', {
        message: `Room "${roomCode}" not found! Make sure the host has created the room and shared the correct code.`
      });
      return;
    }

    if (room.members.length >= 8) {
      socket.emit('room-error', { message: 'Room is full! (Max 8 members)' });
      return;
    }

    // Remove duplicate if same user rejoins
    room.members = room.members.filter(m => m.username !== username);
    room.members.push({ socketId: socket.id, username });

    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.username = username;

    const memberNames = room.members.map(m => m.username);
    const isHostUser = room.hostSocketId === socket.id || room.hostName === username;

    // Tell joiner they joined
    socket.emit('room-joined', {
      roomCode,
      members: memberNames,
      memberCount: room.members.length,
      movie: room.movie,
      isHost: isHostUser,
      videoState: room.videoState,
      hostName: room.hostName
    });

    // Update ALL members
    io.to(roomCode).emit('room-update', {
      members: memberNames,
      memberCount: room.members.length,
      hostName: room.hostName
    });

    // System message to all
    io.to(roomCode).emit('chat-message', {
      type: 'system',
      message: `${username} joined the room 🎉`,
      timestamp: Date.now()
    });

    console.log(`👥 ${username} joined room ${roomCode} (${room.members.length} members)`);
  });

  // VIDEO CONTROL (host broadcasts to members)
  socket.on('video-control', ({ roomCode, action, currentTime }) => {
    const room = ROOMS.get(roomCode);
    if (!room) return;

    if (action === 'play') room.videoState = { isPlaying: true, currentTime: currentTime || 0 };
    if (action === 'pause') room.videoState = { isPlaying: false, currentTime: currentTime || 0 };
    if (action === 'seek') room.videoState.currentTime = currentTime || 0;

    // Send to everyone EXCEPT host
    socket.to(roomCode).emit('video-sync', {
      action,
      currentTime: currentTime || 0,
      isPlaying: room.videoState.isPlaying
    });

    console.log(`📹 ${socket.username} ${action} in room ${roomCode}`);
  });

  // CHAT MESSAGE
  socket.on('send-message', ({ roomCode, message }) => {
    if (!message?.trim()) return;

    const msgData = {
      type: 'user',
      username: socket.username || 'Guest',
      message: message.trim().substring(0, 500),
      timestamp: Date.now()
    };

    // Send to ALL in room including sender
    io.to(roomCode).emit('chat-message', msgData);
    console.log(`💬 ${socket.username}: ${message.substring(0, 30)} in ${roomCode}`);
  });

  // LEAVE ROOM
  socket.on('leave-room', ({ roomCode }) => {
    handleLeave(socket, roomCode);
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    if (socket.roomCode) handleLeave(socket, socket.roomCode);
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

function handleLeave(socket, roomCode) {
  const room = ROOMS.get(roomCode);
  if (!room) return;

  room.members = room.members.filter(m => m.socketId !== socket.id);
  console.log(`👋 ${socket.username} left room ${roomCode}`);

  if (room.members.length === 0) {
    ROOMS.delete(roomCode);
    console.log(`🗑️ Room ${roomCode} deleted`);
    return;
  }

  // Transfer host if needed
  if (room.hostSocketId === socket.id) {
    room.hostSocketId = room.members[0].socketId;
    room.hostName = room.members[0].username;
    io.to(room.members[0].socketId).emit('host-transferred', {
      message: 'You are now the host! 👑'
    });
  }

  const memberNames = room.members.map(m => m.username);

  io.to(roomCode).emit('room-update', {
    members: memberNames,
    memberCount: room.members.length,
    hostName: room.hostName
  });

  io.to(roomCode).emit('chat-message', {
    type: 'system',
    message: `${socket.username} left the room`,
    timestamp: Date.now()
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎬 Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready`);
});
