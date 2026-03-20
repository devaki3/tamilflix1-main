// Quiz System
const QUIZ_QUESTIONS = [
  {
    key: 'mood',
    question: "🎭 What mood are you in today?",
    options: [
      { value: 'excited', emoji: '⚡', text: 'Excited & Pumped Up', desc: 'Ready for adrenaline' },
      { value: 'romantic', emoji: '❤️', text: 'Romantic & Dreamy', desc: 'In the mood for love' },
      { value: 'funny', emoji: '😂', text: 'Want to Laugh', desc: 'Need some comedy' },
      { value: 'sad', emoji: '😢', text: 'Emotional & Reflective', desc: 'Ready to feel deeply' },
      { value: 'scared', emoji: '😱', text: 'Thrill & Fright', desc: 'Love being scared' },
      { value: 'inspired', emoji: '✨', text: 'Need Inspiration', desc: 'Looking for motivation' }
    ]
  },
  {
    key: 'storyType',
    question: "📖 What type of story do you prefer?",
    options: [
      { value: 'love', emoji: '💕', text: 'Love Story', desc: 'Romance and relationships' },
      { value: 'action', emoji: '🥊', text: 'Action & Adventure', desc: 'Fights and thrills' },
      { value: 'social', emoji: '🌍', text: 'Social Drama', desc: 'Real issues, powerful messages' },
      { value: 'comedy', emoji: '🎪', text: 'Pure Comedy', desc: 'Non-stop laughs' },
      { value: 'horror', emoji: '💀', text: 'Horror & Mystery', desc: 'Supernatural and scary' },
      { value: 'classic', emoji: '🏛️', text: 'Classic Tamil Cinema', desc: 'Golden era films' }
    ]
  },
  {
    key: 'preference',
    question: "⚔️ Do you prefer action-packed or emotionally driven stories?",
    options: [
      { value: 'action', emoji: '💥', text: 'Full-on Action', desc: 'Give me fights and chases' },
      { value: 'emotional', emoji: '💧', text: 'Deep Emotions', desc: 'Stories that touch my heart' },
      { value: 'both', emoji: '⚖️', text: 'A Mix of Both', desc: 'Action with emotional depth' },
      { value: 'neither', emoji: '😌', text: 'Light & Easy', desc: 'Something fun and breezy' }
    ]
  },
  {
    key: 'pace',
    question: "⏱️ What movie pace do you enjoy?",
    options: [
      { value: 'fast', emoji: '🚀', text: 'Fast-Paced', desc: 'Non-stop, edge of my seat' },
      { value: 'medium', emoji: '🚗', text: 'Medium Pace', desc: 'Balanced storytelling' },
      { value: 'slow', emoji: '🌅', text: 'Slow & Thoughtful', desc: 'Deep, immersive experience' }
    ]
  },
  {
    key: 'ending',
    question: "🎬 What kind of ending do you prefer?",
    options: [
      { value: 'happy', emoji: '😄', text: 'Happy Ending', desc: 'Feel good finale' },
      { value: 'triumphant', emoji: '🏆', text: 'Triumphant Victory', desc: 'Hero wins, justice served' },
      { value: 'bittersweet', emoji: '🌸', text: 'Bittersweet', desc: 'Beautiful but melancholic' },
      { value: 'twist', emoji: '🌀', text: 'Shocking Twist', desc: 'Surprise me!' }
    ]
  },
  {
    key: 'heroType',
    question: "🦸 What type of hero do you love?",
    options: [
      { value: 'mass', emoji: '🔥', text: 'Mass Hero', desc: 'Rajini, Vijay style — pure mass' },
      { value: 'common', emoji: '👨', text: 'Common Man', desc: 'Realistic, relatable hero' },
      { value: 'sensitive', emoji: '🌺', text: 'Sensitive & Deep', desc: 'Complex, emotional character' },
      { value: 'any', emoji: '🎭', text: 'Doesn\'t Matter', desc: 'Just give me a great film' }
    ]
  },
  {
    key: 'tone',
    question: "🎭 Comedy or Intense Drama?",
    options: [
      { value: 'comedy', emoji: '😆', text: 'Comedy All the Way', desc: 'Laughter is the best medicine' },
      { value: 'drama', emoji: '🎭', text: 'Intense Drama', desc: 'Serious, gripping storytelling' },
      { value: 'mix', emoji: '🎪', text: 'Mix of Comedy & Drama', desc: 'Balance of both worlds' }
    ]
  },
  {
    key: 'watchTime',
    question: "🕐 When and how are you watching?",
    options: [
      { value: 'night', emoji: '🌙', text: 'Late Night Alone', desc: 'Perfect for thrillers/horror' },
      { value: 'family', emoji: '👨‍👩‍👧', text: 'With Family', desc: 'Family-friendly film' },
      { value: 'alone', emoji: '🎧', text: 'Alone & Cozy', desc: 'Emotional/romantic film' },
      { value: 'friends', emoji: '🍿', text: 'With Friends', desc: 'Fun, entertaining film' }
    ]
  }
];

let currentQuizStep = 0;
let quizAnswers = {};

function startQuiz() {
  currentQuizStep = 0;
  quizAnswers = {};
  renderQuizStep();
}

function renderQuizStep() {
  const q = QUIZ_QUESTIONS[currentQuizStep];
  const total = QUIZ_QUESTIONS.length;
  const pct = Math.round((currentQuizStep / total) * 100);

  // Update progress
  document.getElementById('quiz-progress-fill').style.width = `${pct}%`;
  document.getElementById('quiz-step-label').textContent = `Question ${currentQuizStep + 1} of ${total}`;
  document.getElementById('quiz-pct-label').textContent = `${pct}% Complete`;

  // Update question
  document.getElementById('quiz-question').textContent = q.question;

  // Render options
  const optionsEl = document.getElementById('quiz-options');
  optionsEl.innerHTML = q.options.map(opt => `
    <div class="quiz-option ${quizAnswers[q.key] === opt.value ? 'selected' : ''}"
      onclick="selectQuizOption('${q.key}', '${opt.value}', this)">
      <span class="quiz-option-emoji">${opt.emoji}</span>
      <div>
        <div class="quiz-option-text">${opt.text}</div>
        ${opt.desc ? `<div class="quiz-option-desc">${opt.desc}</div>` : ''}
      </div>
    </div>
  `).join('');

  // Prev button
  const prevBtn = document.getElementById('quiz-prev-btn');
  if (currentQuizStep > 0) {
    prevBtn.classList.remove('hidden');
  } else {
    prevBtn.classList.add('hidden');
  }

  // Next button
  const nextBtn = document.getElementById('quiz-next-btn');
  const hasAnswer = quizAnswers[q.key] !== undefined;
  nextBtn.disabled = !hasAnswer;

  if (currentQuizStep === total - 1) {
    nextBtn.textContent = '🎬 Get My Recommendation!';
  } else {
    nextBtn.textContent = 'Next Question →';
  }
}

function selectQuizOption(key, value, el) {
  quizAnswers[key] = value;

  // Update visual
  document.querySelectorAll('.quiz-option').forEach(opt => opt.classList.remove('selected'));
  el.classList.add('selected');

  // Enable next button
  const nextBtn = document.getElementById('quiz-next-btn');
  nextBtn.disabled = false;

  // Auto-advance after short delay on mobile
  if (window.innerWidth < 768) {
    setTimeout(() => quizNext(), 400);
  }
}

function quizNext() {
  const q = QUIZ_QUESTIONS[currentQuizStep];
  if (!quizAnswers[q.key]) {
    showToast('⚠️', 'Please select an option');
    return;
  }

  if (currentQuizStep < QUIZ_QUESTIONS.length - 1) {
    currentQuizStep++;
    renderQuizStep();
  } else {
    submitQuiz();
  }
}

function quizPrev() {
  if (currentQuizStep > 0) {
    currentQuizStep--;
    renderQuizStep();
  }
}

async function submitQuiz() {
  showPage('recommendation');
  const content = document.getElementById('recommendation-content');
  content.innerHTML = `
    <div class="text-center py-16">
      <div class="text-6xl mb-4 animate-bounce">🎬</div>
      <p class="text-gray-300">Analyzing your taste in Tamil cinema...</p>
      <div class="mt-4 h-1 bg-white/10 rounded-full max-w-xs mx-auto overflow-hidden">
        <div class="h-full bg-red-600 rounded-full animate-pulse w-3/4"></div>
      </div>
    </div>
  `;

  try {
    const data = await API.getRecommendation(quizAnswers);
    if (data.error) {
      content.innerHTML = `<p class="text-center text-red-400 py-16">${data.error}</p>`;
      return;
    }
    renderRecommendation(data.recommended, data.alternatives);
  } catch (err) {
    content.innerHTML = `<p class="text-center text-red-400 py-16">Failed to get recommendation. Please try again.</p>`;
  }
}

function renderRecommendation(movie, alternatives = []) {
  const content = document.getElementById('recommendation-content');
  const genres = Array.isArray(movie.genre) ? movie.genre : [];
  const cast = Array.isArray(movie.cast) ? movie.cast : [];
  const poster = movie.poster || 'https://via.placeholder.com/300x450/141414/888?text=No+Poster';

  content.innerHTML = `
    <div class="rec-card mb-8 fade-in-up">
      <div class="p-6 md:p-8">
        <div class="flex flex-col md:flex-row gap-8">
          <div class="flex-shrink-0">
            <img src="${poster}" alt="${movie.title}" 
              class="w-full md:w-52 rounded-xl shadow-2xl mx-auto md:mx-0"
              onerror="this.src='https://via.placeholder.com/200x300/141414/888?text=No+Poster'">
          </div>
          <div class="flex-1">
            <div class="text-red-500 text-xs font-bold uppercase tracking-wider mb-2">🎯 Your Perfect Match</div>
            <h2 class="text-3xl md:text-4xl font-extrabold mb-2 hero-title-font">${movie.title}</h2>
            <div class="flex items-center gap-3 mb-3 text-sm text-gray-400">
              <span>⭐ ${movie.rating}/10</span>
              <span>•</span>
              <span>${movie.year}</span>
              <span>•</span>
              <span>${movie.director}</span>
            </div>
            <div class="flex flex-wrap gap-2 mb-4">
              ${genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}
            </div>
            <p class="text-gray-300 text-sm leading-relaxed mb-5">${movie.description}</p>
            <div class="text-xs text-gray-500 mb-5">Cast: ${cast.join(' · ')}</div>
            <div class="flex gap-3 flex-wrap">
              <button onclick="openMovieDetail(${movie.id}, true)"
                class="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all text-sm flex items-center gap-2">
                ▶ Watch Trailer
              </button>
              <button onclick="openWatchTogether(${movie.id})"
                class="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-2.5 rounded-xl transition-all text-sm flex items-center gap-2">
                👥 Watch Together
              </button>
              <button onclick="startQuiz()"
                class="border border-white/20 hover:border-white/40 text-gray-300 hover:text-white font-bold px-6 py-2.5 rounded-xl transition-all text-sm">
                🔄 Retake Quiz
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Trailer -->
    <div class="mb-8">
      <h3 class="text-lg font-bold mb-4">Official Trailer</h3>
      ${buildTrailerPlayer(movie.trailer, movie.title, false)}
    </div>

    ${alternatives.length > 0 ? `
    <div>
      <h3 class="text-lg font-bold mb-4">You Might Also Like</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        ${alternatives.map(m => `
          <div class="bg-white/5 border border-white/8 rounded-xl overflow-hidden cursor-pointer hover:border-red-600/50 transition-all"
            onclick="openMovieDetail(${m.id})">
            <img src="${m.poster || 'https://via.placeholder.com/180x270/141414/888?text='+encodeURIComponent(m.title)}" 
              alt="${m.title}" class="w-full aspect-video object-cover object-top"
              onerror="this.src='https://via.placeholder.com/180x100/141414/888?text='+encodeURIComponent('${m.title}')">
            <div class="p-3">
              <div class="font-bold text-sm">${m.title}</div>
              <div class="text-xs text-gray-400">${m.year} • ⭐${m.rating}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;
}