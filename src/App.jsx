// ---------------------------------------------------------------------------
// APP — Root component for Yo Movies (Clerk + Convex + TMDB)
// ---------------------------------------------------------------------------
// - Theme / last mood persist in Convex `preferences` when signed in
// - "Already seen" persists in Convex `watched` (falls back to local Set)
// - Favorites persist in Convex `favorites` (heart button on cards)
// - Every mood pick is logged to Convex `moodActivity`
// - Signed-out visitors get the same UI backed by local state
// ---------------------------------------------------------------------------

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api } from '../convex/_generated/api';
import THEMES from './config/theme';
import { MOODS } from './config/moods';
import { isApiKeyConfigured } from './services/tmdb';
import { useMovies, useSurpriseMovies } from './hooks/useMovies';
import Header from './components/Header';
import MoodPicker from './components/MoodPicker';
import MovieGrid from './components/MovieGrid';
import MovieDetails from './components/MovieDetails';

export default function App() {
  const { isAuthenticated } = useConvexAuth();

  // --- Convex state (null/[] while loading or signed out) ---
  const prefs = useQuery(api.preferences.get);
  const watchedList = useQuery(api.watched.list);
  const favoritesList = useQuery(api.favorites.list);

  const setPrefs = useMutation(api.preferences.set);
  const addWatched = useMutation(api.watched.add);
  const clearWatched = useMutation(api.watched.clear);
  const addFavorite = useMutation(api.favorites.add);
  const removeFavorite = useMutation(api.favorites.remove);
  const logMood = useMutation(api.activity.log);

  // --- Local fallback state (signed-out + instant UI) ---
  const [localTheme, setLocalTheme] = useState('dark');
  const [localMood, setLocalMood] = useState(null);
  const [localExcluded, setLocalExcluded] = useState(() => new Set());
  const [localFavorites, setLocalFavorites] = useState(() => new Set());

  // Random-movie surprise (null = off). A fresh seed redeals the hand.
  const [surpriseSeed, setSurpriseSeed] = useState(null);
  const surprise = useSurpriseMovies(surpriseSeed);
  const SURPRISE_MOOD = {
    id: 'surprise',
    label: 'Surprise picks',
    blurb: 'random treasures — no mood required',
  };

  // Snapshot day being viewed (null = latest). Reset on mood change.
  const [historyDate, setHistoryDate] = useState(null);

  // Opened movie (details overlay). Null = grid view.
  const [selectedMovie, setSelectedMovie] = useState(null);

  // Resolve effective state: Convex wins when signed in and loaded.
  // (Empty-string lastMood means "back at the main menu" — see handleHome.)
  // NOTE: selectedMood must be defined before any hook that reads it.
  const themeName =
    isAuthenticated && prefs?.theme ? prefs.theme : localTheme;
  const selectedMood =
    isAuthenticated && prefs !== undefined
      ? (prefs?.lastMood || localMood)
      : localMood;

  const snapshotHistory = useQuery(
    api.snapshots.history,
    selectedMood ? { moodId: selectedMood, limit: 7 } : 'skip'
  );

  const excludedSet =
    isAuthenticated && watchedList
      ? new Set(watchedList.map((w) => w.tmdbId))
      : localExcluded;

  const favoriteIds =
    isAuthenticated && favoritesList
      ? new Set(favoritesList.map((f) => f.tmdbId))
      : localFavorites;

  const t = THEMES[themeName] ?? THEMES.dark;

  // Fetch movies: Convex daily snapshot first, live TMDB fallback.
  // Surprise mode bypasses moods entirely with random trending picks.
  const moodResult = useMovies(surpriseSeed != null ? null : selectedMood, historyDate);
  const isSurprise = surpriseSeed != null;
  const movies = isSurprise ? surprise.movies : moodResult.movies;
  const loading = isSurprise ? surprise.loading : moodResult.loading;
  const error = isSurprise ? surprise.error : moodResult.error;
  const source = isSurprise ? 'live' : moodResult.source;
  const date = moodResult.date;

  // Filter out watched/excluded movies
  const filteredMovies = movies.filter((m) => !excludedSet.has(m.id));

  // Find the active mood object for displaying the blurb
  const activeMood = isSurprise
    ? SURPRISE_MOOD
    : MOODS.find((m) => m.id === selectedMood);

  // --- Callbacks ---
  const toggleTheme = useCallback(() => {
    const next =
      (isAuthenticated && prefs?.theme ? prefs.theme : localTheme) === 'dark'
        ? 'light'
        : 'dark';
    setLocalTheme(next);
    if (isAuthenticated) setPrefs({ theme: next }).catch(() => {});
  }, [isAuthenticated, prefs, localTheme, setPrefs]);

  const handleMoodSelect = useCallback(
    (moodId) => {
      setLocalMood(moodId);
      setHistoryDate(null); // back to latest snapshot for the new mood
      setSelectedMovie(null); // close any open details
      setSurpriseSeed(null); // leave surprise mode
      if (isAuthenticated) {
        setPrefs({ lastMood: moodId }).catch(() => {});
        logMood({ moodId }).catch(() => {});
      }
    },
    [isAuthenticated, setPrefs, logMood]
  );

  // "Surprise me" — deal a fresh hand of random movies, no mood involved
  const handleSurprise = useCallback(() => {
    setLocalMood(null);
    setHistoryDate(null);
    setSelectedMovie(null);
    if (isAuthenticated) setPrefs({ lastMood: '' }).catch(() => {});
    setSurpriseSeed(Date.now());
  }, [isAuthenticated, setPrefs]);

  // Logo / site name → back to the main menu
  const handleHome = useCallback(() => {
    setLocalMood(null);
    setHistoryDate(null);
    setSelectedMovie(null);
    setSurpriseSeed(null);
    // Empty string clears the persisted mood (see selectedMood above)
    if (isAuthenticated) setPrefs({ lastMood: '' }).catch(() => {});
  }, [isAuthenticated, setPrefs]);

  const handleExclude = useCallback(
    (movie) => {
      const tmdbId = typeof movie === 'object' ? movie.id : movie;
      const title = typeof movie === 'object' ? movie.title : undefined;
      if (isAuthenticated) {
        addWatched({ tmdbId, title }).catch(() => {});
      } else {
        setLocalExcluded((prev) => {
          const next = new Set(prev);
          next.add(tmdbId);
          return next;
        });
      }
    },
    [isAuthenticated, addWatched]
  );

  const handleClearExcluded = useCallback(() => {
    setLocalExcluded(new Set());
    if (isAuthenticated) clearWatched().catch(() => {});
  }, [isAuthenticated, clearWatched]);

  const handleToggleFavorite = useCallback(
    (movie) => {
      if (isAuthenticated) {
        if (favoriteIds.has(movie.id)) {
          removeFavorite({ tmdbId: movie.id }).catch(() => {});
        } else {
          addFavorite({
            tmdbId: movie.id,
            title: movie.title,
            posterPath: movie.poster_path ?? undefined,
          }).catch(() => {});
        }
      } else {
        setLocalFavorites((prev) => {
          const next = new Set(prev);
          if (next.has(movie.id)) next.delete(movie.id);
          else next.add(movie.id);
          return next;
        });
      }
    },
    [isAuthenticated, favoriteIds, addFavorite, removeFavorite]
  );

  // Check if API key is configured
  const apiReady = isApiKeyConfigured();

  const favoritesForRow =
    isAuthenticated && favoritesList
      ? favoritesList
      : movies.filter((m) => localFavorites.has(m.id));

  return (
    <div
      style={{
        minHeight: '100vh',
        background: t.bg,
        color: t.text,
        fontFamily: "'Inter', system-ui, sans-serif",
        transition: 'background 0.25s ease, color 0.25s ease',
      }}
    >
      {/* Global styles */}
      <style>{`
        .mood-btn { transition: border-color 0.15s ease, color 0.15s ease; }
        .theme-toggle { transition: background 0.15s ease, transform 0.1s ease; }
        .theme-toggle:active { transform: scale(0.94); }
        .card {
          animation: rise 0.35s ease both;
          position: relative;
          overflow: hidden;
        }
        .card:hover { border-color: ${t.accent}44; }
        @keyframes rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) { .card { animation: none; } }
        input::placeholder { color: ${t.muted}; opacity: 0.8; }
        .exclude-btn { transition: opacity 0.15s ease, color 0.15s ease; opacity: 0.55; }
        .exclude-btn:hover { opacity: 1; color: ${t.accent}; }
        img { user-select: none; -webkit-user-drag: none; }
      `}</style>

      <Header theme={themeName} t={t} onToggleTheme={toggleTheme} onHome={handleHome} />

      <MoodPicker
        t={t}
        selectedMood={selectedMood}
        onMoodSelect={handleMoodSelect}
        onSurprise={handleSurprise}
        apiReady={apiReady}
      />

      {/* Favorites strip (persisted in Convex when signed in) */}
      {favoritesForRow.length > 0 && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 0' }}>
          <h3 style={{ fontSize: 14, color: t.muted, margin: '0 0 12px' }}>
            ♥ Your favorites ({favoritesForRow.length})
          </h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {favoritesForRow.slice(0, 10).map((f) => (
              <span
                key={f.tmdbId ?? f.id}
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 999,
                  padding: '4px 12px',
                  fontSize: 12.5,
                }}
              >
                {f.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Film-strip divider */}
      {(selectedMood || isSurprise) && (
        <div
          style={{
            width: '100%',
            maxWidth: 640,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`,
            margin: '48px auto 40px',
          }}
        />
      )}

      {/* Movie results */}
      {(selectedMood || isSurprise) && (
        <MovieGrid
          t={t}
          movies={filteredMovies}
          loading={loading}
          error={error}
          activeMood={activeMood}
          excludedCount={excludedSet.size}
          onExclude={handleExclude}
          onClearExcluded={handleClearExcluded}
          apiReady={apiReady}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
          source={source}
          activeDate={date}
          history={isSurprise ? [] : (snapshotHistory ?? [])}
          onSelectDate={setHistoryDate}
          onSelect={setSelectedMovie}
        />
      )}

      {/* Details overlay */}
      {selectedMovie && (
        <MovieDetails
          movie={selectedMovie}
          t={t}
          onClose={() => setSelectedMovie(null)}
        />
      )}

      {/* TMDB Attribution — required by their terms of service */}
      <footer
        style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: t.muted,
          fontSize: 12,
          opacity: 0.6,
        }}
      >
        Powered by{' '}
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: t.accent, textDecoration: 'none' }}
        >
          TMDB
        </a>
        . This product uses the TMDB API but is not endorsed or certified by TMDB.
      </footer>
    </div>
  );
}
