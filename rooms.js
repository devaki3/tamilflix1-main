const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

let db;
function setDb(database) { db = database; }

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tamilflix_secret');
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/rooms/create
router.post('/create', authMiddleware, (req, res) => {
  try {
    const { movieId } = req.body;
    const roomCode = uuidv4().split('-')[0].toUpperCase();

    const room = db.prepare(`
      INSERT INTO rooms (room_code, host_id, movie_id) VALUES (?, ?, ?)
    `).run(roomCode, req.user.userId, movieId || null);

    // Add host as member
    db.prepare(`INSERT INTO room_members (room_id, user_id, username) VALUES (?, ?, ?)`)
      .run(room.lastInsertRowid, req.user.userId, req.user.name);

    res.json({
      roomCode,
      roomId: room.lastInsertRowid,
      message: 'Room created! Share the code with friends.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// POST /api/rooms/join
router.post('/join', authMiddleware, (req, res) => {
  try {
    const { roomCode } = req.body;
    
    const room = db.prepare('SELECT * FROM rooms WHERE room_code = ? AND is_active = 1').get(roomCode);
    if (!room) return res.status(404).json({ error: 'Room not found or has ended' });

    const memberCount = db.prepare('SELECT COUNT(*) as count FROM room_members WHERE room_id = ?').get(room.id);
    if (memberCount.count >= room.max_members) {
      return res.status(400).json({ error: 'Room is full (max 8 members)' });
    }

    const existing = db.prepare('SELECT id FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, req.user.userId);
    if (!existing) {
      db.prepare('INSERT INTO room_members (room_id, user_id, username) VALUES (?, ?, ?)')
        .run(room.id, req.user.userId, req.user.name);
    }

    const movie = room.movie_id ? db.prepare('SELECT * FROM movies WHERE id = ?').get(room.movie_id) : null;
    const members = db.prepare('SELECT username FROM room_members WHERE room_id = ?').all(room.id);

    res.json({
      roomCode,
      roomId: room.id,
      movie: movie ? {
        ...movie,
        genre: JSON.parse(movie.genre || '[]'),
        cast: JSON.parse(movie.cast || '[]')
      } : null,
      members: members.map(m => m.username),
      isHost: room.host_id === req.user.userId
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// GET /api/rooms/:code/messages
router.get('/:code/messages', authMiddleware, (req, res) => {
  try {
    const room = db.prepare('SELECT id FROM rooms WHERE room_code = ?').get(req.params.code);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const messages = db.prepare('SELECT * FROM messages WHERE room_id = ? ORDER BY created_at ASC LIMIT 100').all(room.id);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = { router, setDb };
