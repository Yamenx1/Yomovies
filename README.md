# Yo Movies

A mood-based movie recommendation app. Type how you're feeling and get real movie suggestions powered by AI.

**Live at [yo-movies.vercel.app](https://yo-movies.vercel.app/)**

---

## What it does

Instead of browsing genres or searching titles, you describe your mood — anything from *"stressed about work"* to *"want something weird and funny"* — and the app finds movies that match.

Behind the scenes, Gemini interprets your input, suggests movie titles, and each one gets verified against TMDB to make sure it actually exists and has a poster. Results are cached so repeated searches are instant.

**Core features:**
- Natural language movie search (no rigid categories)
- "Surprise me" button for trending picks
- Favorites and watchlist that sync across devices
- Personalized recommendations based on your taste
- Google and email sign-in
- Dark and light mode

---

## Tech stack

- **React 18** + **Vite** — frontend
- **Convex** — database and serverless backend
- **Clerk** — authentication
- **Google Gemini** — AI recommendations
- **TMDB API** — movie data, posters, ratings
- **Vercel** — hosting

---

## Project structure

```
├── convex/                  # Backend
│   ├── schema.js            # Database tables
│   ├── aiRecommend.js       # Gemini → TMDB verification pipeline
│   ├── favorites.js         # Favorites CRUD
│   ├── watchlist.js         # Watchlist CRUD
│   ├── watched.js           # "Already seen" tracking
│   ├── preferences.js       # Theme & mood persistence
│   └── auth.config.js       # Clerk ↔ Convex bridge
│
├── src/
│   ├── App.jsx              # Main app component
│   ├── main.jsx             # Provider chain (Clerk → Convex → App)
│   ├── config/              # Theme colors, UI strings
│   ├── services/            # TMDB client, recommendation engine
│   ├── hooks/               # Data fetching hooks
│   └── components/          # UI components
│       ├── Header.jsx
│       ├── MoodPicker.jsx
│       ├── MovieGrid.jsx
│       ├── MovieCard.jsx
│       ├── MovieDetails.jsx
│       ├── FavoritesDrawer.jsx
│       └── ErrorBoundary.jsx
```

---

## Running locally

You'll need Node.js 18+, and free accounts on [TMDB](https://www.themoviedb.org/settings/api), [Clerk](https://clerk.com/), and [Convex](https://convex.dev/).

```bash
git clone https://github.com/Yamenx1/Yomovies.git
cd Yomovies
npm install
```

Create a `.env` file:

```
VITE_TMDB_API_KEY=your_key
VITE_CLERK_PUBLISHABLE_KEY=your_key
VITE_CONVEX_URL=your_url
```

Then start the backend and frontend:

```bash
npx convex dev        # terminal 1
npm run dev           # terminal 2
```

---

## How the AI search works

1. User types a mood description
2. Gemini generates a list of movie titles that match
3. Each title is searched on TMDB to verify it exists
4. Only movies with valid posters and metadata are returned
5. Results get cached in Convex — same query = instant response next time

---

## Credits
Yamenx1

- Movie data from [TMDB](https://www.themoviedb.org/) (not endorsed by TMDB)
- AI by [Google Gemini](https://deepmind.google/technologies/gemini/)
- Auth by [Clerk](https://clerk.com/)
- Backend by [Convex](https://convex.dev/)
