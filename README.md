<div align="center">

# 🎬 Yo Movies

**Tell me your mood — I'll find the perfect movie.**

An AI-powered movie recommendation app that understands how you *feel*, not just what you search for.

[![Live Demo](https://img.shields.io/badge/Live-yo--movies.vercel.app-FF6B4A?style=for-the-badge&logo=vercel&logoColor=white)](https://yo-movies.vercel.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![Convex](https://img.shields.io/badge/Convex-Backend-8B5CF6?style=flat-square&logo=convex&logoColor=white)](https://convex.dev/)
[![Clerk](https://img.shields.io/badge/Clerk-Auth-6C47FF?style=flat-square&logo=clerk&logoColor=white)](https://clerk.com/)
[![TMDB](https://img.shields.io/badge/TMDB-API-01D277?style=flat-square&logo=themoviedatabase&logoColor=white)](https://www.themoviedb.org/)

</div>

---

## ✨ Features

### 🧠 AI-Powered Mood Search
Type anything — *"stressed about exams"*, *"want to cry"*, *"something weird and funny"* — and **Google Gemini** interprets your feeling, suggests real movies, and **TMDB verifies** each one exists with a poster and metadata. No rigid categories, no keyword matching — just natural language.

### 🎲 Surprise Me
Can't decide? Hit the **Surprise** button for random trending picks curated from TMDB's daily trending data.

### ❤️ Favorites & Watchlist
- **Heart** a movie to add it to your favorites
- **Bookmark** a movie to save it to your watchlist
- Both persist across sessions when signed in (Convex) or in localStorage when browsing as a guest

### 🎯 "For You" Taste Profile
The app learns your taste from your favorites and watchlist. Over time, it builds a genre-weighted profile to surface movies that match *your* preferences.

### 👤 Authentication
Sign in with **Google** or **email/password** via **Clerk**. Your favorites, watchlist, watched history, and theme preference sync across devices.

### 🌓 Dark & Light Mode
Two carefully designed palettes matching the Yo Movies brand — coral accent (#FF6B4A) stays consistent across both.

### 🎥 Movie Details
Click any movie card for a detailed view with full overview, rating, release year, genres, and action buttons.

### 🔍 Smart Caching
AI recommendation results are cached in Convex's `aiCache` table — identical searches return instantly without new API calls.

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite | UI framework + blazing-fast dev server |
| **Styling** | Inline styles + CSS | No framework — lean and custom |
| **Auth** | Clerk | Google + email/password sign-in |
| **Backend** | Convex | Real-time database, serverless functions |
| **AI** | Google Gemini | Natural language → movie recommendations |
| **Movie Data** | TMDB API | Posters, ratings, genres, metadata |
| **Hosting** | Vercel | Production deployment |
| **Icons** | Lucide React | Lightweight icon library |
| **Fonts** | Fraunces + Inter | Serif headings + clean body text |

---

## 📁 Project Structure

```
YOmovies/
├── index.html                        # Entry HTML with font imports
├── package.json                      # Dependencies & scripts
├── vite.config.js                    # Vite configuration
│
├── convex/                           # ⚡ Convex backend
│   ├── schema.js                     # Database tables (preferences, watched,
│   │                                 #   favorites, watchlist, moodActivity,
│   │                                 #   aiCache, recentSearches)
│   ├── aiRecommend.js                # Gemini AI → TMDB verification pipeline
│   ├── auth.config.js                # Clerk ↔ Convex auth bridge
│   ├── favorites.js                  # Add/remove/list favorites
│   ├── watchlist.js                  # Add/remove/list watch-later
│   ├── watched.js                    # Mark movies as already seen
│   ├── preferences.js                # Theme & mood persistence
│   ├── recent.js                     # Recent search history
│   ├── activity.js                   # Mood activity logging
│   └── crons.js                      # Scheduled jobs (placeholder)
│
├── src/
│   ├── main.jsx                      # Clerk → Convex → App provider chain
│   ├── App.jsx                       # Root component — state orchestration
│   │
│   ├── config/
│   │   ├── theme.js                  # Dark / light color palettes
│   │   └── strings.js                # UI copy & mood definitions
│   │
│   ├── services/
│   │   ├── tmdb.js                   # TMDB API client + caching
│   │   └── recommend.js              # Taste profile builder
│   │
│   ├── hooks/
│   │   └── useMovies.js              # Movie fetching hook
│   │
│   └── components/
│       ├── Header.jsx                # Logo + auth + theme toggle
│       ├── MoodPicker.jsx            # Search input + mood buttons
│       ├── MovieGrid.jsx             # Responsive poster grid
│       ├── MovieCard.jsx             # Card with poster, rating, actions
│       ├── MovieDetails.jsx          # Full movie detail view
│       ├── FavoritesDrawer.jsx       # Side panel for favorites/watchlist
│       ├── LoadingSpinner.jsx        # Animated loading indicator
│       └── ErrorBoundary.jsx         # Graceful crash handler
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [TMDB API key](https://www.themoviedb.org/settings/api) (free)
- [Clerk account](https://clerk.com/) (free)
- [Convex account](https://convex.dev/) (free)

### 1. Clone the repo

```bash
git clone https://github.com/Yamenx1/Yomovies.git
cd Yomovies
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the project root:

```env
# TMDB — movie data & posters
VITE_TMDB_API_KEY=your_tmdb_api_key

# Clerk — authentication
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Convex — backend
VITE_CONVEX_URL=your_convex_deployment_url
```

### 4. Start Convex backend

```bash
npx convex dev
```

### 5. Start the dev server

In a separate terminal:

```bash
npm run dev
```

Open **http://localhost:3000** and start exploring! 🎉

---

## 🔑 API Keys Setup

| Service | Where to get it | What it does |
|---------|----------------|--------------|
| **TMDB** | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) | Movie posters, ratings, genres, search |
| **Clerk** | [clerk.com](https://clerk.com/) → Create app → API Keys | User authentication (Google + email) |
| **Convex** | [convex.dev](https://convex.dev/) → `npx convex dev` | Real-time database, AI actions |
| **Gemini** | Set in Convex dashboard as env var | AI mood → movie recommendations |

---

## 🧪 How It Works

```
User types: "I'm exhausted and need something cozy"
                        ↓
              Google Gemini analyzes the feeling
                        ↓
        Gemini suggests: ["Paddington 2", "My Neighbor Totoro", ...]
                        ↓
           Each title verified against TMDB API
           (must exist + have a poster + metadata)
                        ↓
         Results cached in Convex aiCache table
                        ↓
        Beautiful cards with real posters, ratings,
              genres, and action buttons
```

---

## 📸 Screenshots

| Dark Mode | Light Mode |
|-----------|------------|
| 🌙 Elegant dark theme | ☀️ Clean light theme |

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source under the [ISC License](LICENSE).

---

## 🙏 Credits

- Movie data provided by [TMDB](https://www.themoviedb.org/) — this product uses the TMDB API but is not endorsed or certified by TMDB
- AI recommendations powered by [Google Gemini](https://deepmind.google/technologies/gemini/)
- Authentication by [Clerk](https://clerk.com/)
- Backend by [Convex](https://convex.dev/)
- Icons by [Lucide](https://lucide.dev/)

---

<div align="center">

**Built with ❤️ by [Yamenx1](https://github.com/Yamenx1)**

[Live Demo](https://yo-movies.vercel.app/) · [Report Bug](https://github.com/Yamenx1/Yomovies/issues) · [Request Feature](https://github.com/Yamenx1/Yomovies/issues)

</div>
