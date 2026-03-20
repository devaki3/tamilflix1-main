const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'tamil_movies.db');

function initializeDatabase() {
  const db = new Database(DB_PATH);
  
  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_verified INTEGER DEFAULT 0,
      otp TEXT,
      otp_expires INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      avatar TEXT DEFAULT NULL
    )
  `);

  // Create Movies table
  db.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      year INTEGER,
      genre TEXT,
      mood TEXT,
      pace TEXT,
      hero_type TEXT,
      ending TEXT,
      description TEXT,
      poster TEXT,
      trailer TEXT,
      rating REAL,
      director TEXT,
      cast TEXT,
      tags TEXT
    )
  `);

  // Create QuizResults table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      answers TEXT NOT NULL,
      recommended_movie_id INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (recommended_movie_id) REFERENCES movies(id)
    )
  `);

  // Create Rooms table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT UNIQUE NOT NULL,
      host_id INTEGER NOT NULL,
      movie_id INTEGER,
      max_members INTEGER DEFAULT 8,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (host_id) REFERENCES users(id),
      FOREIGN KEY (movie_id) REFERENCES movies(id)
    )
  `);

  // Create RoomMembers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS room_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      user_id INTEGER,
      username TEXT,
      joined_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    )
  `);

  // Create Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      user_id INTEGER,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    )
  `);

  // Seed movies from JSON
  const moviesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'movies.json'), 'utf-8'));
  
  const insertMovie = db.prepare(`
    INSERT OR IGNORE INTO movies (id, title, year, genre, mood, pace, hero_type, ending, description, poster, trailer, rating, director, cast, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((movies) => {
    for (const movie of movies) {
      insertMovie.run(
        movie.id,
        movie.title,
        movie.year,
        JSON.stringify(movie.genre),
        JSON.stringify(movie.mood),
        movie.pace,
        movie.hero_type,
        movie.ending,
        movie.description,
        movie.poster,
        movie.trailer,
        movie.rating,
        movie.director,
        JSON.stringify(movie.cast),
        JSON.stringify(movie.tags)
      );
    }
  });

  insertMany(moviesData);

  console.log('✅ Database initialized successfully');
  return db;
}

module.exports = { initializeDatabase, DB_PATH };
