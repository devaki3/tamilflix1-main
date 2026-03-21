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
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialize database
const db = initializeDatabase();
setAuthDb(db);
setMoviesDb(db);
setRoomsDb(db);

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
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
});

// Socket.io - Watch Together Room Management
const rooms = new Map(); // roomCode -> { members, videoState, hostSocketId }

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Join a watch room
  socket.on('join-room', ({ roomCode, username, token }) => {
    try {
      let userId = null;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tamilflix_secret');
        userId = decoded.userId;
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
      
      // Check max members
      if (room.members.length >= 8) {
        socket.emit('error', { message: 'Room is full (max 8 members)' });
        return;
      }

      // Remove existing member with same socket
      room.members = room.members.filter(m => m.socketId !== socket.id);
      room.members.push({ socketId: socket.id, username: socket.username, userId });

      // Notify all room members
      io.to(roomCode).emit('room-update', {
        members: room.members.map(m => m.username),
        memberCount: room.members.length
      });

      // Send current video state to new member
      socket.emit('video-sync', room.videoState);

      // System message
      io.to(roomCode).emit('chat-message', {
        type: 'system',
        message: `${socket.username} joined the room`,
        timestamp: Date.now()
      });

      console.log(`👥 ${socket.username} joined room ${roomCode}`);
    } catch (err) {
      console.error('Join room error:', err.message);
    }
  });

  // Video control sync (host only)
  socket.on('video-control', ({ roomCode, action, currentTime }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    // Update room video state
    if (action === 'play') room.videoState = { isPlaying: true, currentTime, lastUpdate: Date.now() };
    if (action === 'pause') room.videoState = { isPlaying: false, currentTime, lastUpdate: Date.now() };
    if (action === 'seek') room.videoState = { ...room.videoState, currentTime, lastUpdate: Date.now() };

    // Broadcast to all other members
    socket.to(roomCode).emit('video-sync', { action, currentTime, isPlaying: room.videoState.isPlaying });
  });

  // Chat messages
  socket.on('send-message', ({ roomCode, message }) => {
    if (!message || !message.trim()) return;
    
    const msgData = {
      type: 'user',
      username: socket.username,
      message: message.trim().substring(0, 500),
      timestamp: Date.now()
    };

    // Save to DB
    try {
      const room = db.prepare('SELECT id FROM rooms WHERE room_code = ?').get(roomCode);
      if (room) {
        db.prepare('INSERT INTO messages (room_id, username, message) VALUES (?, ?, ?)')
          .run(room.id, socket.username, message.trim());
      }
    } catch (e) {}

    io.to(roomCode).emit('chat-message', msgData);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const { roomCode, username } = socket;
    if (roomCode && rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      room.members = room.members.filter(m => m.socketId !== socket.id);
      
      if (room.members.length === 0) {
        rooms.delete(roomCode);
      } else {
        // Transfer host if needed
        if (room.hostSocketId === socket.id && room.members.length > 0) {
          room.hostSocketId = room.members[0].socketId;
        }
        
        io.to(roomCode).emit('room-update', {
          members: room.members.map(m => m.username),
          memberCount: room.members.length
        });

        io.to(roomCode).emit('chat-message', {
          type: 'system',
          message: `${username} left the room`,
          timestamp: Date.now()
        });
      }
    }
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎬 TamilFlix Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io ready for Watch Together`);
  console.log(`🗄️  Database initialized`);
  console.log(`\nOpen your browser and go to: http://localhost:${PORT}\n`);
});
