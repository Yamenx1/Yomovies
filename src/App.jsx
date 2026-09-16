// ---------------------------------------------------------------------------
// APP — Root component for Yo Movies (Clerk + Convex + TMDB + Gemini)
// ---------------------------------------------------------------------------
// - Search: Gemini names real films for ANY feeling, TMDB verifies each one
// - Surprise: random trending picks, no input needed
// - Theme / watched / favorites persist in Convex when signed in,
//   local state when signed out
// ---------------------------------------------------------------------------

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api } from '../convex/_generated/api';
import THEMES from './config/theme';
import { isApiKeyConfigured } from './services/tmdb';
import { useSurpriseMovies } from './hooks/useMovies';
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

  // --- Local fallback state (signed-out + instant UI) ---
  const [localTheme, setLocalTheme] = useState('dark');
  const [localExcluded, setLocalExcluded] = useState(() => new Set());
  const [localFavorites, setLocalFavorites] = useState(() => new Set());

  // AI search results (null = nothing searched yet)
  const [search, setSearch] = useState(null);

  // Random-movie surprise (null = off). A fresh seed redeals the hand.
  const [surpriseSeed, setSurpriseSeed] = useState(null);
  const surprise = useSurpriseMovies(surpriseSeed);

  // Opened movie (details overlay). Null = grid view.
  const [selectedMovie, setSelectedMovie] = useState(null);

  const themeName =
    isAuthenticated && prefs?.theme ? prefs.theme : localTheme;

  const excludedSet =
    isAuthenticated && watchedList
      ? new Set(watchedList.map((w) => w.tmdbId))
      : localExcluded;

  const favoriteIds =
    isAuthenticated && favoritesList
      ? new Set(favoritesList.map((f) => f.tmdbId))
      : localFavorites;

  const t = THEMES[themeName] ?? THEMES.dark;

  // What the grid shows: surprise hand wins, otherwise the latest search
  const isSurprise = surpriseSeed != null;
  const viewing = isSurprise
    ? {
        movies: surprise.movies,
        loading: surprise.loading,
        error: surprise.error,
        heading: 'Surprise picks — random treasures, no input required.',
        badge: 'Live picks',
      }
    : search == null
      ? { movies: [], loading: false, error: null, heading: null, badge: null }
      : {
          movies: search.movies,
          loading: search.loading,
          error: search.error,
          heading: search.reason,
          badge: 'AI picks',
        };

  // Filter out watched/excluded movies
  const filteredMovies = viewing.movies.filter((m) => !excludedSet.has(m.id));

  // --- Callbacks ---
  const toggleTheme = useCallback(() => {
    const next =
      (isAuthenticated && prefs?.theme ? prefs.theme : localTheme) === 'dark'
        ? 'light'
        : 'dark';
    setLocalTheme(next);
    if (isAuthenticated) setPrefs({ theme: next }).catch(() => {});
  }, [isAuthenticated, prefs, localTheme, setPrefs]);

  // AI search completed in MoodPicker — show its movies
  const handleResults = useCallback((results) => {
    setSearch({ ...results, loading: false, error: null });
    setSelectedMovie(null); // close any open details
    setSurpriseSeed(null); // leave surprise mode
  }, []);

  const handleSearchLoading = useCallback((loading) => {
    setSearch((prev) => ({ ...(prev ?? { movies: [] }), loading, error: null }));
    if (loading) {
      setSelectedMovie(null);
      setSurpriseSeed(null);
    }
  }, []);

  const handleSearchError = useCallback((message) => {
    setSearch((prev) => ({
      ...(prev ?? { movies: [] }),
      loading: false,
      error: message,
    }));
  }, []);

  // "Surprise me" — deal a fresh hand of random movies
  const handleSurprise = useCallback(() => {
    setSearch(null);
    setSelectedMovie(null);
    setSurpriseSeed(Date.now());
  }, []);

  // Logo / site name → back to the main menu
  const handleHome = useCallback(() => {
    setSearch(null);
    setSelectedMovie(null);
    setSurpriseSeed(null);
  }, []);

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
      : viewing.movies.filter((m) => localFavorites.has(m.id));

  const showResults =
    viewing.loading || viewing.error || viewing.movies.length > 0;

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
        onResults={handleResults}
        onSearchLoading={handleSearchLoading}
        onSearchError={handleSearchError}
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
      {showResults && (
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
      {showResults && (
        <MovieGrid
          t={t}
          movies={filteredMovies}
          loading={viewing.loading}
          error={viewing.error}
          heading={viewing.heading}
          badge={viewing.badge}
          excludedCount={excludedSet.size}
          onExclude={handleExclude}
          onClearExcluded={handleClearExcluded}
          apiReady={apiReady}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
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
