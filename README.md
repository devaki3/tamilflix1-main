# 🎬 TamilFlix - Tamil Movie Recommendation Website

A Netflix-style Tamil movie discovery and recommendation platform with quiz-based recommendations, real-time Watch Together rooms, and a beautiful cinematic UI.

---

## ✨ Features

- 🔐 **Secure Auth** — Signup/Login with Gmail + OTP email verification
- 🎬 **30+ Tamil Movies** — Organized by genre with posters, trailers & descriptions
- 🔍 **Instant Search** — Real-time movie search as you type
- 🎯 **Quiz Recommendation** — 8-question quiz picks your perfect Tamil film
- 👥 **Watch Together** — Real-time rooms (up to 8 people) with live chat & video sync
- 📱 **Fully Responsive** — Works on mobile, tablet, and desktop
- 🌙 **Dark Cinematic UI** — Netflix-inspired design

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm 8+

### Installation

```bash
# 1. Extract the ZIP file
unzip tamil-movie-recommendation-site.zip
cd tamil-movie-recommendation-site

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your settings (see below)

# 4. Start the server
npm start
```

Open your browser: **http://localhost:3000**

---

## ⚙️ Environment Variables (.env)

```env
PORT=3000
JWT_SECRET=your_super_secret_key_here

# Gmail SMTP (for OTP emails)
# Get App Password: https://myaccount.google.com/apppasswords
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_16_char_app_password
```

> **Note**: If email is not configured, OTPs are logged to the console and shown on screen in development mode.

---

## 📁 Project Structure

```
tamil-movie-recommendation-site/
├── backend/
│   ├── server.js          # Express + Socket.io server
│   └── routes/
│       ├── auth.js        # Login, signup, OTP
│       ├── movies.js      # Movie CRUD + recommendation
│       └── rooms.js       # Watch together rooms
├── database/
│   ├── init.js            # SQLite initialization
│   ├── movies.json        # 30 Tamil movie dataset
│   └── tamil_movies.db    # Auto-generated SQLite DB
├── frontend/
│   ├── index.html         # Main SPA
│   ├── css/
│   │   └── styles.css     # Custom styles
│   └── js/
│       ├── api.js         # API helper functions
│       ├── app.js         # App orchestrator
│       ├── auth.js        # Auth handling
│       ├── movies.js      # Movie rendering + search
│       ├── quiz.js        # Quiz system
│       └── watch-together.js # Watch room + socket
├── .env.example
├── netlify.toml
├── package.json
└── README.md
```

---

## 🌐 Deployment

### Option 1: Deploy Full Stack on Railway (Recommended)

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables in Railway dashboard
4. Railway auto-detects Node.js and deploys!

### Option 2: Netlify (Frontend Only)

> ⚠️ Netlify only serves static files. For full functionality including auth, quiz, and watch rooms, you need a separate backend.

**For full-stack Netlify deployment:**
1. Deploy backend on [Render.com](https://render.com) (free tier available):
   - New Web Service → Connect GitHub repo
   - Build command: `npm install`
   - Start command: `npm start`
   - Add environment variables
2. Update `frontend/js/api.js` — change `BASE: '/api'` to your Render URL
3. Deploy frontend to Netlify:
   - New Site → Import from GitHub → Set publish directory to `frontend`

### Option 3: Heroku

```bash
# Install Heroku CLI, then:
heroku create your-tamilflix-app
heroku config:set JWT_SECRET=your_secret EMAIL_USER=... EMAIL_PASS=...
git push heroku main
```

---

## 🎮 Using the App

### 1. Authentication
- Click **Sign Up** → enter name, Gmail, password
- Check your email for OTP (or see it on screen in dev mode)
- Enter OTP to verify → you're in!

### 2. Browse Movies
- Scroll through Netflix-style genre rows
- Hover over any card to see details
- Click a card to open full movie detail with trailer

### 3. Quiz Recommendation
- Click the **QUIZ** button in the navbar
- Answer 8 questions about your mood and preferences
- Get a personalized Tamil movie recommendation!

### 4. Watch Together
- On any movie detail page, click **Watch Together**
- Create a room → share the 6-character code with friends
- Or enter a friend's code to join their room
- Watch the trailer together + live chat in real-time

---

## 🎬 Tamil Movie Collection (30 Films)

| Genre | Films |
|-------|-------|
| Action | Vikram, Master, Kaithi, Mersal, Bigil, Theri, Beast, Leo |
| Romance | 96, VTV, OK Kanmani, Love Today, Raja Rani, Sillunu Oru Kadhal |
| Feel Good | Don, Doctor, Oh My Kadavule, Kanaa |
| Comedy | Boss Engira Bhaskaran, Kalakalappu |
| Drama | Pariyerum Perumal, Asuran, Deiva Thirumagal |
| Horror | Pizza, Demonte Colony, Aranmanai |
| Classic | Baasha, Padayappa, Nayakan, Annamalai |

---

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/signup | Create account |
| POST | /api/auth/verify-otp | Verify OTP |
| POST | /api/auth/login | Login |
| POST | /api/auth/resend-otp | Resend OTP |
| GET | /api/movies | Get all movies |
| GET | /api/movies/:id | Get movie by ID |
| GET | /api/movies?search=q | Search movies |
| GET | /api/movies?genre=g | Filter by genre |
| POST | /api/movies/recommend | Get quiz recommendation |
| POST | /api/rooms/create | Create watch room |
| POST | /api/rooms/join | Join watch room |
| GET | /api/rooms/:code/messages | Get chat messages |

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JS, Tailwind CSS (CDN)
- **Backend**: Node.js, Express.js
- **Database**: SQLite (better-sqlite3)
- **Real-time**: Socket.io
- **Auth**: JWT + bcryptjs
- **Email**: Nodemailer (Gmail SMTP)

---

## 📝 Notes

- SQLite database is auto-created on first run
- In development, OTPs are shown on screen for testing
- Movie posters load from IMDB CDN (requires internet)
- YouTube trailers are embedded (requires internet)
- Socket.io enables real-time watch room sync

---

Made with ❤️ for Tamil Cinema fans
