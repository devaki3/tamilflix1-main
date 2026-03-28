require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

const { initializeDatabase } = require('./database/init');
const { router: authRouter, setDb: setAuthDb } = require('./auth');
const { router: roomsRouter, setDb: setRoomsDb } = require('./rooms');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket']
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Initialize database
const db = initializeDatabase();
setAuthDb(db);
setRoomsDb(db);

// Movies router inline
const moviesRouter = express.Router();
moviesRouter.get('/', (req, res) => {
  try {
    const { search, genre } = req.query;
    let movies;
    if (search) {
      movies = db.prepare("SELECT * FROM movies WHERE title LIKE ?").all(`%${search}%`);
    } else if (genre) {
      movies = db.prepare("SELECT * FROM movies").all().filter(m => {
        try { return JSON.parse(m.genre || '[]').includes(genre); } catch { return false; }
      });
    } else {
      movies = db.prepare("SELECT * FROM movies").all();
    }
    res.json(movies.map(m => ({
      ...m,
      genre: JSON.parse(m.genre || '[]'),
      cast: JSON.parse(m.cast || '[]'),
      tags: JSON.parse(m.tags || '[]'),
      mood: JSON.parse(m.mood || '[]')
    })));
  } catch (e) { res.status(500).json({ error: 'Failed to fetch movies' }); }
});
moviesRouter.get('/:id', (req, res) => {
  try {
    const movie = db.prepare("SELECT * FROM movies WHERE id = ?").get(req.params.id);
    if (!movie) return res.status(404).json({ error: 'Movie not found' });
    res.json({ ...movie, genre: JSON.parse(movie.genre||'[]'), cast: JSON.parse(movie.cast||'[]'), tags: JSON.parse(movie.tags||'[]'), mood: JSON.parse(movie.mood||'[]') });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch movie' }); }
});
moviesRouter.post('/recommend', (req, res) => {
  try {
    const movies = db.prepare("SELECT * FROM movies").all();
    const r = movies[Math.floor(Math.random() * movies.length)];
    res.json({ ...r, genre: JSON.parse(r.genre||'[]'), cast: JSON.parse(r.cast||'[]'), tags: JSON.parse(r.tags||'[]'), mood: JSON.parse(r.mood||'[]') });
  } catch (e) { res.status(500).json({ error: 'Recommendation failed' }); }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/movies', moviesRouter);
app.use('/api/rooms', roomsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '🎬 TamilFlix API is running!' });
});

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'frontend/index.html'));
  }
});

// Socket.io - Watch Together Room Management
const rooms = new Map(); // roomCode -> { members, videoState, hostSocketId }

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on('join-room', ({ roomCode, username, token }) => {
    try {
      let userId = null;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tamilflix_secret');
          userId = decoded.userId;
        } catch (e) {}
      }

      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.username = username || 'Guest';

      if (!rooms.has(roomCode)) {
        rooms.set(roomCode, {
          members: [],
          videoState: { isPlaying: false, currentTime: 0, lastUpdate: Date.now() },
          hostSocketId: socket.id
        });
      }

      const room = rooms.get(roomCode);

      if (room.members.length >= 8) {
        socket.emit('error', { message: 'Room is full (max 8 members)' });
        return;
      }

      room.members = room.members.filter(m => m.socketId !== socket.id);
      room.members.push({ socketId: socket.id, username: socket.username, userId });

      // Tell joining socket whether they are host
      socket.emit('host-status', { isHost: room.hostSocketId === socket.id });

      // Broadcast updated member list to everyone
      io.to(roomCode).emit('room-update', {
        members: room.members.map(m => m.username),
        memberCount: room.members.length,
        hostSocketId: room.hostSocketId
      });

      // Send current video state to new joiner
      socket.emit('video-sync', {
        action: room.videoState.isPlaying ? 'play' : 'pause',
        currentTime: room.videoState.currentTime,
        isPlaying: room.videoState.isPlaying
      });

      // System notification
      io.to(roomCode).emit('chat-message', {
        type: 'system',
        message: `${socket.username} joined the room 🎉`,
        timestamp: Date.now()
      });

      console.log(`👥 ${socket.username} joined room ${roomCode} (${room.members.length}/8)`);
    } catch (err) {
      console.error('Join room error:', err.message);
    }
  });

  socket.on('video-control', ({ roomCode, action, currentTime }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostSocketId !== socket.id) return;

    if (action === 'play')  room.videoState = { isPlaying: true,  currentTime, lastUpdate: Date.now() };
    if (action === 'pause') room.videoState = { isPlaying: false, currentTime, lastUpdate: Date.now() };
    if (action === 'seek')  room.videoState = { ...room.videoState, currentTime, lastUpdate: Date.now() };

    io.to(roomCode).emit('video-sync', { action, currentTime, isPlaying: room.videoState.isPlaying });
  });

  socket.on('send-message', ({ roomCode, message }) => {
    if (!message || !message.trim()) return;

    const msgData = {
      type: 'user',
      username: socket.username,
      message: message.trim().substring(0, 500),
      timestamp: Date.now()
    };

    try {
      const room = db.prepare('SELECT id FROM rooms WHERE room_code = ?').get(roomCode);
      if (room) {
        db.prepare('INSERT INTO messages (room_id, username, message) VALUES (?, ?, ?)')
          .run(room.id, socket.username, message.trim());
      }
    } catch (e) {}

    io.to(roomCode).emit('chat-message', msgData);
  });

  socket.on('leave-room', ({ roomCode }) => {
    handleLeave(socket, roomCode);
    socket.leave(roomCode);
  });

  socket.on('disconnect', () => {
    const { roomCode } = socket;
    if (roomCode) handleLeave(socket, roomCode);
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

function handleLeave(socket, roomCode) {
  if (!roomCode || !rooms.has(roomCode)) return;
  const room = rooms.get(roomCode);
  room.members = room.members.filter(m => m.socketId !== socket.id);

  if (room.members.length === 0) { rooms.delete(roomCode); return; }

  if (room.hostSocketId === socket.id) {
    room.hostSocketId = room.members[0].socketId;
    io.to(room.members[0].socketId).emit('host-status', { isHost: true });
  }

  io.to(roomCode).emit('room-update', {
    members: room.members.map(m => m.username),
    memberCount: room.members.length,
    hostSocketId: room.hostSocketId
  });

  io.to(roomCode).emit('chat-message', {
    type: 'system',
    message: `${socket.username} left the room`,
    timestamp: Date.now()
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎬 TamilFlix Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io ready for Watch Together`);
  console.log(`🗄️  Database initialized`);
  console.log(`\nOpen your browser and go to: http://localhost:${PORT}\n`);
});
