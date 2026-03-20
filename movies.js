const express = require('express');
const router = express.Router();

let db;
function setDb(database) { db = database; }

// Helper to parse JSON fields from movie rows
function parseMovie(movie) {
  if (!movie) return null;
  return {
    ...movie,
    genre: JSON.parse(movie.genre || '[]'),
    mood: JSON.parse(movie.mood || '[]'),
    cast: JSON.parse(movie.cast || '[]'),
    tags: JSON.parse(movie.tags || '[]')
  };
}

// GET /api/movies - Get all movies
router.get('/', (req, res) => {
  try {
    const { genre, search, limit = 100 } = req.query;
    let query = 'SELECT * FROM movies';
    let params = [];

    if (search) {
      query += ' WHERE title LIKE ?';
      params.push(`%${search}%`);
    } else if (genre) {
      query += ' WHERE genre LIKE ?';
      params.push(`%${genre}%`);
    }

    query += ' LIMIT ?';
    params.push(parseInt(limit));

    const movies = db.prepare(query).all(...params);
    res.json(movies.map(parseMovie));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// GET /api/movies/:id - Get single movie
router.get('/:id', (req, res) => {
  try {
    const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(req.params.id);
    if (!movie) return res.status(404).json({ error: 'Movie not found' });
    res.json(parseMovie(movie));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch movie' });
  }
});

// GET /api/movies/genre/:genre - Get movies by genre
router.get('/genre/:genre', (req, res) => {
  try {
    const movies = db.prepare('SELECT * FROM movies WHERE genre LIKE ?').all(`%${req.params.genre}%`);
    res.json(movies.map(parseMovie));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// POST /api/movies/recommend - Quiz-based recommendation
router.post('/recommend', (req, res) => {
  try {
    const { answers } = req.body;
    // answers: { mood, storyType, actionOrEmotional, pace, ending, heroType, comedyOrDrama, watchTime }

    const allMovies = db.prepare('SELECT * FROM movies').all().map(parseMovie);
    
    // Scoring system
    const scored = allMovies.map(movie => {
      let score = 0;
      const tags = movie.tags || [];
      const genre = movie.genre || [];
      const mood = movie.mood || [];

      // Mood matching
      if (answers.mood === 'excited' && (tags.includes('action') || tags.includes('fast'))) score += 3;
      if (answers.mood === 'romantic' && (tags.includes('romance') || tags.includes('romantic'))) score += 3;
      if (answers.mood === 'funny' && (tags.includes('comedy') || tags.includes('fun'))) score += 3;
      if (answers.mood === 'sad' && (tags.includes('emotional') || tags.includes('tearjerker'))) score += 3;
      if (answers.mood === 'scared' && (tags.includes('horror') || tags.includes('scary'))) score += 3;
      if (answers.mood === 'inspired' && (tags.includes('inspiring') || tags.includes('feel-good'))) score += 3;

      // Story type
      if (answers.storyType === 'love' && (genre.includes('Romance') || tags.includes('romance'))) score += 2;
      if (answers.storyType === 'action' && (genre.includes('Action') || tags.includes('action'))) score += 2;
      if (answers.storyType === 'social' && (tags.includes('social') || tags.includes('powerful'))) score += 2;
      if (answers.storyType === 'comedy' && (genre.includes('Comedy') || tags.includes('comedy'))) score += 2;
      if (answers.storyType === 'horror' && (genre.includes('Horror') || tags.includes('horror'))) score += 2;
      if (answers.storyType === 'classic' && (tags.includes('classic') || tags.includes('iconic'))) score += 2;

      // Action or Emotional
      if (answers.preference === 'action' && (tags.includes('action') || tags.includes('mass'))) score += 2;
      if (answers.preference === 'emotional' && (tags.includes('emotional') || mood.includes('Emotional'))) score += 2;
      if (answers.preference === 'both' && movie.genre.length > 1) score += 1;

      // Pace
      if (answers.pace === 'fast' && movie.pace === 'Fast') score += 2;
      if (answers.pace === 'medium' && movie.pace === 'Medium') score += 2;
      if (answers.pace === 'slow' && movie.pace === 'Slow') score += 2;

      // Ending
      if (answers.ending === 'happy' && movie.ending === 'Happy') score += 2;
      if (answers.ending === 'triumphant' && movie.ending === 'Triumphant') score += 2;
      if (answers.ending === 'bittersweet' && movie.ending === 'Bittersweet') score += 2;
      if (answers.ending === 'twist' && (movie.ending === 'Twist' || movie.ending === 'Shocking')) score += 2;

      // Hero type
      if (answers.heroType === 'mass' && movie.hero_type === 'Mass Hero') score += 2;
      if (answers.heroType === 'common' && movie.hero_type === 'Common Man') score += 2;
      if (answers.heroType === 'sensitive' && movie.hero_type === 'Sensitive Man') score += 2;

      // Comedy or drama
      if (answers.tone === 'comedy' && (tags.includes('comedy') || tags.includes('fun'))) score += 2;
      if (answers.tone === 'drama' && (tags.includes('powerful') || tags.includes('intense'))) score += 2;
      if (answers.tone === 'mix' && genre.length >= 2) score += 1;

      // Watch time
      if (answers.watchTime === 'night' && (tags.includes('horror') || tags.includes('thriller'))) score += 1;
      if (answers.watchTime === 'family' && (tags.includes('family') || tags.includes('feel-good'))) score += 1;
      if (answers.watchTime === 'alone' && (tags.includes('emotional') || tags.includes('romantic'))) score += 1;
      if (answers.watchTime === 'friends' && (tags.includes('comedy') || tags.includes('action'))) score += 1;

      // Boost by rating
      score += movie.rating * 0.3;

      return { ...movie, score };
    });

    scored.sort((a, b) => b.score - a.score);
    
    const recommendations = scored.slice(0, 5);

    res.json({
      recommended: recommendations[0],
      alternatives: recommendations.slice(1, 4)
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ error: 'Failed to generate recommendation' });
  }
});

module.exports = { router, setDb };
