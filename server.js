require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const path    = require('path');
const jwt     = require('jsonwebtoken');

const { initializeDatabase }          = require('./database/init');
const { router: authRouter,  setDb: setAuthDb  } = require('./auth');
const { router: roomsRouter, setDb: setRoomsDb } = require('./rooms');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['polling', 'websocket']
});

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

const db = initializeDatabase();
setAuthDb(db);
setRoomsDb(db);

const moviesRouter = express.Router();

moviesRouter.get('/', (req, res) => {
  try {
    const { search, genre } = req.query;
    let rows;
    if (search) {
      rows = db.prepare('SELECT * FROM movies WHERE title LIKE ?').all(`%${search}%`);
    } else if (genre) {
      rows = db.prepare('SELECT * FROM movies').all().filter(m => {
        try { return JSON.parse(m.genre || '[]').includes(genre); } catch { return false; }
      });
    } else {
      rows = db.prepare('SELECT * FROM movies').all();
    }
    res.json(rows.map(_parseMovie));
  } catch (e) { res.status(500).json({ error: 'Failed to fetch movies' }); }
});

moviesRouter.get('/:id', (req, res) => {
  try {
    const m = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Movie not found' });
    res.json(_parseMovie(m));
  } catch (e) { res.status(500).json({ error: 'Failed to fetch movie' }); }
});

moviesRouter.post('/recommend', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM movies').all();
    res.json(_parseMovie(rows[Math.floor(Math.random() * rows.length)]));
  } catch (e) { res.status(500).json({ error: 'Recommendation failed' }); }
});

function _parseMovie(m) {
  return {
    ...m,
    genre : JSON.parse(m.genre  || '[]'),
    cast  : JSON.parse(m.cast   || '[]'),
    tags  : JSON.parse(m.tags   || '[]'),
    mood  : JSON.parse(m.mood   || '[]'),
  };
}

app.use('/api/auth',   authRouter);
app.use('/api/movies', moviesRouter);
app.use('/api/rooms',  roomsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', message: '🎬 PadamPaapoma running!' }));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api'))
    res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  socket.on('join-room', ({ roomCode, username, token }) => {
    try {
      let userId = null;
      if (token) {
        try {
          const dec = jwt.verify(token, process.env.JWT_SECRET || 'tamilflix_secret');
          userId = dec.userId;
        } catch (_) {}
      }

      const uname = username || 'Guest';
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.username = uname;

      if (!rooms.has(roomCode)) {
        rooms.set(roomCode, {
          hostSocketId : socket.id,
          hostUsername : uname,
          members      : [],
          videoState   : { isPlaying: false, currentTime: 0, lastUpdate: Date.now() }
        });
      }

      const room = rooms.get(roomCode);

      if (room.members.length >= 8) {
        socket.emit('error', { message: 'Room is full (max 8 members)' });
        return;
      }

      if (room.hostUsername === uname && room.hostSocketId !== socket.id) {
        console.log(`♻️  Host ${uname} reconnected, updating hostSocketId`);
        room.hostSocketId = socket.id;
      }

      room.members = room.members.filter(
        m => m.socketId !== socket.id && m.username !== uname
      );
      room.members.push({ socketId: socket.id, username: uname, userId });

      const amHost = (room.hostSocketId === socket.id);

      socket.emit('host-status', { isHost: amHost });

      io.to(roomCode).emit('room-update', {
        members      : room.members.map(m => m.username),
        memberCount  : room.members.length,
        hostSocketId : room.hostSocketId,
        hostUsername : room.hostUsername
      });

      socket.emit('video-sync', {
        action      : room.videoState.isPlaying ? 'play' : 'pause',
        currentTime : room.videoState.currentTime,
        isPlaying   : room.videoState.isPlaying
      });

      io.to(roomCode).emit('chat-message', {
        type      : 'system',
        message   : `${uname} joined the room 🎉`,
        timestamp : Date.now()
      });

      console.log(`👥 ${uname} joined room ${roomCode} (${room.members.length}/8) | host: ${room.hostUsername}`);
    } catch (err) {
      console.error('join-room error:', err.message);
    }
  });

  socket.on('video-control', ({ roomCode, action, currentTime }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const isRoomHost = (room.hostSocketId === socket.id) ||
                       (room.hostUsername  === socket.username);

    if (!isRoomHost) {
      console.log(`⛔ Non-host ${socket.username} tried to control video`);
      return;
    }

    if (room.hostSocketId !== socket.id) room.hostSocketId = socket.id;

    if (action === 'play') {
      room.videoState = { isPlaying: true,  currentTime, lastUpdate: Date.now() };
    } else if (action === 'pause') {
      room.videoState = { isPlaying: false, currentTime, lastUpdate: Date.now() };
    } else if (action === 'seek') {
      room.videoState = { ...room.videoState, currentTime, lastUpdate: Date.now() };
    }

    socket.to(roomCode).emit('video-sync', {
      action,
      currentTime,
      isPlaying : room.videoState.isPlaying
    });

    console.log(`📺 ${socket.username} ${action} at ${Math.floor(currentTime)}s → room ${roomCode}`);
  });

  socket.on('send-message', ({ roomCode, message }) => {
    if (!message || !message.trim()) return;

    const msgData = {
      type      : 'user',
      username  : socket.username,
      message   : message.trim().substring(0, 500),
      timestamp : Date.now()
    };

    try {
      const dbRoom = db.prepare('SELECT id FROM rooms WHERE room_code = ?').get(roomCode);
      if (dbRoom) {
        db.prepare('INSERT INTO messages (room_id, username, message) VALUES (?, ?, ?)')
          .run(dbRoom.id, socket.username, message.trim());
      }
    } catch (_) {}

    io.to(roomCode).emit('chat-message', msgData);
  });

  socket.on('leave-room', ({ roomCode }) => {
    _handleMemberLeave(socket, roomCode);
    socket.leave(roomCode);
  });

  socket.on('close-room', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const isRoomHost = (room.hostSocketId === socket.id) ||
                       (room.hostUsername  === socket.username);
    if (!isRoomHost) return;

    _closeRoom(roomCode, `${socket.username} (host) closed the room`);
  });

  socket.on('disconnect', () => {
    const { roomCode, username } = socket;
    if (!roomCode) { console.log(`❌ Disconnected: ${socket.id}`); return; }

    const room = rooms.get(roomCode);
    if (room) {
      const isRoomHost = (room.hostSocketId === socket.id) ||
                         (room.hostUsername  === username);
      if (isRoomHost) {
        _closeRoom(roomCode, `Host disconnected — room closed`);
      } else {
        _handleMemberLeave(socket, roomCode);
      }
    }
    console.log(`❌ Disconnected: ${socket.id} (${username})`);
  });
});

function _closeRoom(roomCode, reason) {
  console.log(`🔴 Room ${roomCode} closed: ${reason}`);
  io.to(roomCode).emit('room-closed', { reason });
  rooms.delete(roomCode);
}

function _handleMemberLeave(socket, roomCode) {
  if (!roomCode || !rooms.has(roomCode)) return;
  const room = rooms.get(roomCode);

  room.members = room.members.filter(m => m.socketId !== socket.id);

  if (room.members.length === 0) {
    rooms.delete(roomCode);
    return;
  }

  io.to(roomCode).emit('room-update', {
    members      : room.members.map(m => m.username),
    memberCount  : room.members.length,
    hostSocketId : room.hostSocketId,
    hostUsername : room.hostUsername
  });

  io.to(roomCode).emit('chat-message', {
    type      : 'system',
    message   : `${socket.username} left the room`,
    timestamp : Date.now()
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎬 PadamPaapoma Server → http://localhost:${PORT}`);
  console.log(`📡 Socket.io ready`);
  console.log(`🗄️  Database ready\n`);
});
