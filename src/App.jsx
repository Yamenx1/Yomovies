// ---------------------------------------------------------------------------
// APP — Root component for Yo Movies (Clerk + Convex + TMDB + Gemini)
// ---------------------------------------------------------------------------
// - Search: Gemini names real films for ANY feeling, TMDB verifies each one
// - Surprise: random trending picks, no input needed
// - Theme / watched / favorites persist in Convex when signed in,
//   local state when signed out
// ---------------------------------------------------------------------------

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api } from '../convex/_generated/api';
import THEMES from './config/theme';
import { STRINGS } from './config/strings';
import { isApiKeyConfigured, getTrending, getImageUrl, setTmdbLang } from './services/tmdb';
import { useSurpriseMovies } from './hooks/useMovies';
import Header from './components/Header';
import MoodPicker from './components/MoodPicker';
import MovieGrid from './components/MovieGrid';
import MovieDetails from './components/MovieDetails';
import FavoritesDrawer from './components/FavoritesDrawer';
import {
  buildTasteProfile,
  recommendFromProfile,
  FAVORITE_WEIGHT,
  WATCHLIST_WEIGHT,
} from './services/recommend';

// Guest taste memory: id → genres, so signed-out hearts/watchlists still
// teach the "For you" profile across reloads
const GUEST_META_KEY = 'yo-meta';
function rememberGuestMeta(movie) {
  if (!movie?.genre_ids?.length) return;
  try {
    const meta = JSON.parse(localStorage.getItem(GUEST_META_KEY) ?? '{}');
    meta[movie.id] = { genres: movie.genre_ids };
    localStorage.setItem(GUEST_META_KEY, JSON.stringify(meta));
  } catch {}
}
function readGuestMeta() {
  try {
    return JSON.parse(localStorage.getItem(GUEST_META_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export default function App() {
  const { isAuthenticated } = useConvexAuth();

  // --- Language (persisted per browser, flips RTL + TMDB language) ---
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('yo-lang') === 'ar' ? 'ar' : 'en';
    } catch {
      return 'en';
    }
  });
  const str = STRINGS[lang] ?? STRINGS.en;
  useEffect(() => {
    try {
      localStorage.setItem('yo-lang', lang);
    } catch {}
    document.documentElement.lang = lang;
    document.documentElement.dir = str.dir;
    setTmdbLang(lang === 'ar' ? 'ar-SA' : 'en-US');
  }, [lang, str.dir]);
  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'ar' ? 'en' : 'ar'));
  }, []);

  // --- Convex state (null/[] while loading or signed out) ---
  const prefs = useQuery(api.preferences.get);
  const watchedList = useQuery(api.watched.list);
  const favoritesList = useQuery(api.favorites.list);
  const watchlistList = useQuery(api.watchlist.list);

  const setPrefs = useMutation(api.preferences.set);
  const addWatched = useMutation(api.watched.add);
  const clearWatched = useMutation(api.watched.clear);
  const addFavorite = useMutation(api.favorites.add);
  const removeFavorite = useMutation(api.favorites.remove);
  const addWatchlist = useMutation(api.watchlist.add);
  const removeWatchlist = useMutation(api.watchlist.remove);

  // --- Local fallback state (signed-out + instant UI) ---
  const [localTheme, setLocalTheme] = useState('dark');
  const [localExcluded, setLocalExcluded] = useState(() => new Set());
  const [localFavorites, setLocalFavorites] = useState(() => new Set());
  const [localWatchlist, setLocalWatchlist] = useState(() => new Set());

  // AI search results (null = nothing searched yet)
  const [search, setSearch] = useState(null);

  // Random-movie surprise (null = off). A fresh seed redeals the hand.
  const [surpriseSeed, setSurpriseSeed] = useState(null);
  const surprise = useSurpriseMovies(surpriseSeed);

  // Opened movie (details overlay). Null = grid view.
  const [selectedMovie, setSelectedMovie] = useState(null);

  // Result filters (reset on every new search / surprise / home)
  const [minRating, setMinRating] = useState(0);
  const [era, setEra] = useState('any');
  const [familyOnly, setFamilyOnly] = useState(false);
  const resetFilters = useCallback(() => {
    setMinRating(0);
    setEra('any');
    setFamilyOnly(false);
  }, []);

  // Favorites drawer (right slide-over)
  const [favOpen, setFavOpen] = useState(false);

  // Poster wall + trending rail (Netflix-style). Real TMDB trending
  // posters; falls back to the aurora if unavailable.
  const [trending, setTrending] = useState([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([getTrending('week', 1), getTrending('week', 2)])
      .then(([a, b]) => {
        if (cancelled) return;
        const seen = new Map();
        for (const m of [...(a.results ?? []), ...(b.results ?? [])]) {
          if (m.poster_path && !seen.has(m.id)) seen.set(m.id, m);
        }
        setTrending([...seen.values()].slice(0, 18));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const collage = trending.map((m) => getImageUrl(m.poster_path, 'w342'));

  // Cursor-reactive glow: writes CSS vars straight to the DOM node,
  // so the spotlight follows the mouse with zero React re-renders
  const rootRef = useRef(null);
  const handleMouseMove = useCallback((e) => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, []);

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

  const watchlistIds =
    isAuthenticated && watchlistList
      ? new Set(watchlistList.map((f) => f.tmdbId))
      : localWatchlist;

  const t = THEMES[themeName] ?? THEMES.dark;

  // What the grid shows: surprise hand wins, otherwise the latest search
  const isSurprise = surpriseSeed != null;
  const viewing = isSurprise
    ? {
        movies: surprise.movies,
        loading: surprise.loading,
        error: surprise.error,
        heading: str.surpriseHeading,
        badge: str.badgeLive,
      }
    : search == null
      ? { movies: [], loading: false, error: null, heading: null, badge: null }
      : {
          movies: search.movies,
          loading: search.loading,
          error: search.error,
          heading: search.reason,
          badge: str.badgeAi,
        };

  // Filter out watched/excluded movies + apply rating/era/family filters
  const yearOf = (m) => (m.release_date ? new Date(m.release_date).getFullYear() : null);
  const filteredMovies = viewing.movies
    .filter((m) => (m.vote_average ?? 0) >= minRating)
    .filter((m) => {
      if (era === 'any') return true;
      const y = yearOf(m);
      if (y == null) return false;
      if (era === 'classic') return y < 2000;
      if (era === 'modern') return y >= 2000 && y <= 2015;
      return y >= 2016;
    })
    .filter(
      (m) =>
        !familyOnly || (m.genre_ids ?? []).some((g) => g === 10751 || g === 16)
    )
    .filter((m) => !excludedSet.has(m.id));

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
    resetFilters();
  }, [resetFilters]);

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
    resetFilters();
    setSurpriseSeed(Date.now());
  }, [resetFilters]);

  // Logo / site name → back to the main menu
  const handleHome = useCallback(() => {
    setSearch(null);
    setSelectedMovie(null);
    setSurpriseSeed(null);
    resetFilters();
  }, [resetFilters]);

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
            genreIds: movie.genre_ids ?? undefined,
          }).catch(() => {});
        }
      } else {
        rememberGuestMeta(movie);
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

  const handleToggleWatchlist = useCallback(
    (movie) => {
      if (isAuthenticated) {
        if (watchlistIds.has(movie.id)) {
          removeWatchlist({ tmdbId: movie.id }).catch(() => {});
        } else {
          addWatchlist({
            tmdbId: movie.id,
            title: movie.title,
            posterPath: movie.poster_path ?? undefined,
            genreIds: movie.genre_ids ?? undefined,
          }).catch(() => {});
        }
      } else {
        rememberGuestMeta(movie);
        setLocalWatchlist((prev) => {
          const next = new Set(prev);
          if (next.has(movie.id)) next.delete(movie.id);
          else next.add(movie.id);
          return next;
        });
      }
    },
    [isAuthenticated, watchlistIds, addWatchlist, removeWatchlist]
  );

  // Check if API key is configured
  const apiReady = isApiKeyConfigured();

  const favoritesForRow =
    isAuthenticated && favoritesList
      ? favoritesList
      : viewing.movies.filter((m) => localFavorites.has(m.id));

  // Ambient backdrop: blurred backdrops of the movies on screen, so the
  // whole page mirrors the current picks. Low-res is plenty when blurred.
  const ambient = viewing.movies
    .filter((m) => m.backdrop_path)
    .slice(0, 3);
  const ambientKey = ambient.map((m) => m.id).join(',');

  // Drawer items need poster/title — Convex rows carry them, signed-out
  // rows resolve against the movies currently on screen
  const toDrawerItems = (rows, localSet) =>
    isAuthenticated && rows
      ? rows.map((f) => ({
          id: f.tmdbId,
          title: f.title,
          poster_path: f.posterPath ?? null,
          release_date: null,
          vote_average: null,
        }))
      : viewing.movies.filter((m) => localSet.has(m.id));
  const favoriteItems = toDrawerItems(favoritesList, localFavorites);
  const watchlistItems = toDrawerItems(watchlistList, localWatchlist);

  // --- "For you" taste profile -------------------------------------------
  // Hearts (+2) and watchlists (+1.5) vote for their genres; trending pool
  // is cosine-scored against the profile. Guests learn from local meta.
  const guestMeta = readGuestMeta();
  const signals = [];
  if (isAuthenticated) {
    for (const f of favoritesList ?? []) {
      signals.push({ genre_ids: f.genre_ids, weight: FAVORITE_WEIGHT });
    }
    for (const f of watchlistList ?? []) {
      signals.push({ genre_ids: f.genre_ids, weight: WATCHLIST_WEIGHT });
    }
  } else {
    const lookupGenres = (id) =>
      guestMeta[id]?.genres ??
      viewing.movies.find((m) => m.id === id)?.genre_ids;
    for (const id of localFavorites) {
      signals.push({ genre_ids: lookupGenres(id), weight: FAVORITE_WEIGHT });
    }
    for (const id of localWatchlist) {
      signals.push({ genre_ids: lookupGenres(id), weight: WATCHLIST_WEIGHT });
    }
  }
  const profile = buildTasteProfile(signals);
  const knownIds = new Set([...favoriteIds, ...watchlistIds, ...excludedSet]);
  const forYou =
    profile.count >= 3 && trending.length > 0
      ? recommendFromProfile(profile, trending, knownIds, 10)
      : [];

  const showResults =
    viewing.loading || viewing.error || viewing.movies.length > 0;

  return (
    <div
      ref={rootRef}
      onMouseMove={handleMouseMove}
      style={{
        minHeight: '100vh',
        background: t.bg,
        color: t.text,
        fontFamily: "'Inter', system-ui, sans-serif",
        transition: 'background 0.25s ease, color 0.25s ease',
        position: 'relative',
        isolation: 'isolate',
        '--mx': '50vw',
        '--my': '20vh',
      }}
    >
      {/* Cinematic glass backdrop: aurora blobs + cursor glow + vignette + grain.
          When movies are on screen, their blurred backdrops take over so the
          page mirrors the current picks. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {ambient.length > 0 ? (
          <div
            key={ambientKey}
            style={{ position: 'absolute', inset: 0, animation: 'ambientIn 1.2s ease' }}
          >
            {ambient.map((m, i) => (
              <div
                key={m.id}
                style={{
                  position: 'absolute',
                  inset: '-5%',
                  backgroundImage: `url(https://image.tmdb.org/t/p/w300${m.backdrop_path})`,
                  backgroundSize: 'cover',
                  backgroundPosition: `${15 + i * 35}% ${20 + i * 25}%`,
                  filter: 'blur(70px) saturate(1.4)',
                  opacity: i === 0 ? 0.5 : 0.35,
                }}
              />
            ))}
            {/* Readability wash in the active theme — kept light on purpose
                so the movies' colors pour through the glass cards */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  themeName === 'dark'
                    ? 'linear-gradient(rgba(21,26,36,0.38), rgba(21,26,36,0.72)),' +
                      ' radial-gradient(ellipse 130% 110% at 50% 45%, transparent 40%, rgba(0,0,0,0.42) 100%)'
                    : 'linear-gradient(rgba(245,243,238,0.60), rgba(245,243,238,0.86)),' +
                      ' radial-gradient(ellipse 130% 110% at 50% 45%, transparent 50%, rgba(21,26,36,0.12) 100%)',
              }}
            />
          </div>
        ) : collage.length > 0 ? (
          /* Netflix-style tilted poster wall (landing state) */
          <div style={{ position: 'absolute', inset: 0, animation: 'ambientIn 1.2s ease' }}>
            <div
              className="collage-pan"
              style={{
                position: 'absolute',
                inset: '-12%',
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 14,
                transform: 'rotate(-8deg) scale(1.15)',
                animation: 'collagePan 70s ease-in-out infinite alternate',
              }}
            >
              {collage.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  style={{
                    width: '100%',
                    aspectRatio: '2 / 3',
                    objectFit: 'cover',
                    borderRadius: 10,
                    opacity: 0.55,
                  }}
                />
              ))}
            </div>
            {/* Dim wash so hero text stays readable */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  themeName === 'dark'
                    ? 'linear-gradient(rgba(21,26,36,0.62), rgba(21,26,36,0.88)),' +
                      ' radial-gradient(ellipse 120% 100% at 50% 40%, transparent 30%, rgba(0,0,0,0.6) 100%)'
                    : 'linear-gradient(rgba(245,243,238,0.78), rgba(245,243,238,0.95)),' +
                      ' radial-gradient(ellipse 120% 100% at 50% 40%, transparent 40%, rgba(21,26,36,0.16) 100%)',
              }}
            />
          </div>
        ) : (
          <>
            {/* Drifting aurora blobs (fallback when posters unavailable) */}
            <div
              className="aurora-a"
              style={{
                position: 'absolute',
                width: '55vmax',
                height: '55vmax',
                left: '-15vmax',
                top: '-20vmax',
                borderRadius: '50%',
                filter: 'blur(90px)',
                background:
                  themeName === 'dark'
                    ? `${t.accent}2E`
                    : '#ffd9c455',
                animation: 'driftA 26s ease-in-out infinite alternate',
              }}
            />
            <div
              className="aurora-b"
              style={{
                position: 'absolute',
                width: '50vmax',
                height: '50vmax',
                right: '-18vmax',
                top: '30vh',
                borderRadius: '50%',
                filter: 'blur(100px)',
                background:
                  themeName === 'dark' ? '#4a6bff26' : '#bcd0ff66',
                animation: 'driftB 32s ease-in-out infinite alternate',
              }}
            />
          </>
        )}
        {/* Cursor-following glass glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(520px circle at var(--mx, 50vw) var(--my, 20vh), ${t.accent}30, transparent 70%)`,
          }}
        />
        {/* Static spotlight + vignette (idle state only — ambient brings its own) */}
        {ambient.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                themeName === 'dark'
                  ? `radial-gradient(ellipse 90% 55% at 50% -10%, ${t.accent}1F, transparent 70%),` +
                    ` radial-gradient(ellipse 130% 110% at 50% 45%, transparent 55%, rgba(0,0,0,0.5) 100%)`
                  : `radial-gradient(ellipse 90% 55% at 50% -10%, #ffffffcc, transparent 70%),` +
                    ` radial-gradient(ellipse 130% 110% at 50% 45%, transparent 60%, rgba(21,26,36,0.12) 100%)`,
            }}
          />
        )}
      </div>
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          opacity: themeName === 'dark' ? 0.07 : 0.05,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
        }}
      />
      {/* Global styles */}
      <style>{`
        .mood-btn { transition: border-color 0.15s ease, color 0.15s ease; }
        .theme-toggle { transition: background 0.15s ease, transform 0.1s ease; }
        .theme-toggle:active { transform: scale(0.94); }
        .movie-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
        }
        @media (max-width: 560px) {
          .movie-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .search-row { flex-wrap: wrap; }
          .search-row input { flex: 1 1 100%; }
          .search-row button[type="submit"] { flex: 1; padding: 12px 20px; }
        }
        @keyframes driftA {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(9vmax, 7vmax) scale(1.15); }
        }
        @keyframes driftB {
          from { transform: translate(0, 0) scale(1.1); }
          to { transform: translate(-8vmax, -6vmax) scale(0.95); }
        }
        @keyframes ambientIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes collagePan {
          from { transform: rotate(-8deg) scale(1.15) translate(0, 0); }
          to { transform: rotate(-8deg) scale(1.15) translate(-2%, 2%); }
        }
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
        @media (prefers-reduced-motion: reduce) { .aurora-a, .aurora-b { animation: none; } }
        @media (prefers-reduced-motion: reduce) { .collage-pan { animation: none; } }
        input::placeholder { color: ${t.muted}; opacity: 0.8; }
        .exclude-btn { transition: opacity 0.15s ease, color 0.15s ease; opacity: 0.55; }
        .exclude-btn:hover { opacity: 1; color: ${t.accent}; }
        img { user-select: none; -webkit-user-drag: none; }
      `}</style>

      <Header
        theme={themeName}
        t={t}
        str={str}
        lang={lang}
        onToggleLang={toggleLang}
        onToggleTheme={toggleTheme}
        onHome={handleHome}
        onOpenFavorites={() => setFavOpen(true)}
        favCount={favoriteIds.size}
      />

      <MoodPicker
        t={t}
        str={str}
        lang={lang}
        onResults={handleResults}
        onSearchLoading={handleSearchLoading}
        onSearchError={handleSearchError}
        onSurprise={handleSurprise}
        onSelectMovie={setSelectedMovie}
        apiReady={apiReady}
      />

      {/* For-you rail (learns from hearts + watchlist, guests included) */}
      {!showResults && forYou.length >= 4 && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '34px 20px 0' }}>
          <h3 style={{ fontSize: 14, color: t.text, margin: '0 0 4px' }}>
            ✨ {str.forYouTitle}
          </h3>
          <p style={{ fontSize: 12.5, color: t.muted, margin: '0 0 12px' }}>
            {str.forYouSub}
          </p>
          <div
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 10,
              scrollSnapType: 'x mandatory',
            }}
          >
            {forYou.map((m) => (
              <img
                key={m.id}
                src={getImageUrl(m.poster_path, 'w185')}
                alt={m.title}
                title={m.title}
                loading="lazy"
                onClick={() => setSelectedMovie(m)}
                style={{
                  width: 110,
                  aspectRatio: '2 / 3',
                  objectFit: 'cover',
                  borderRadius: 10,
                  cursor: 'pointer',
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                  border: `1px solid ${t.accent}66`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Trending rail (landing only — doubles as instant details entry) */}
      {!showResults && trending.length > 0 && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '34px 20px 0' }}>
          <h3 style={{ fontSize: 14, color: t.muted, margin: '0 0 12px' }}>
            {str.trendingTitle}
          </h3>
          <div
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 10,
              scrollSnapType: 'x mandatory',
            }}
          >
            {trending.map((m) => (
              <img
                key={m.id}
                src={getImageUrl(m.poster_path, 'w185')}
                alt={m.title}
                title={m.title}
                loading="lazy"
                onClick={() => setSelectedMovie(m)}
                style={{
                  width: 110,
                  aspectRatio: '2 / 3',
                  objectFit: 'cover',
                  borderRadius: 10,
                  cursor: 'pointer',
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                  border: `1px solid ${t.border}`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Favorites strip (persisted in Convex when signed in) */}
      {favoritesForRow.length > 0 && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 0' }}>
          <h3 style={{ fontSize: 14, color: t.muted, margin: '0 0 12px' }}>
            {str.yourFavorites(favoritesForRow.length)}
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
        <>
          {/* Filters */}
          <div
            style={{
              maxWidth: 960,
              margin: '0 auto',
              padding: '0 20px 14px',
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <select
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              aria-label={str.minRating}
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 12.5,
                color: t.text,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <option value={0}>{str.anyRating} ★</option>
              <option value={6}>★ 6+</option>
              <option value={7}>★ 7+</option>
              <option value={8}>★ 8+</option>
            </select>
            <select
              value={era}
              onChange={(e) => setEra(e.target.value)}
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 12.5,
                color: t.text,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <option value="any">{str.eraAny}</option>
              <option value="classic">{str.eraClassic}</option>
              <option value="modern">{str.eraModern}</option>
              <option value="recent">{str.eraRecent}</option>
            </select>
            <button
              onClick={() => setFamilyOnly((v) => !v)}
              style={{
                background: familyOnly ? `${t.accent}22` : 'none',
                border: `1px solid ${familyOnly ? t.accent : t.border}`,
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                color: familyOnly ? t.text : t.muted,
                fontFamily: 'inherit',
              }}
            >
              {str.familyOnly}
            </button>
            {(minRating > 0 || era !== 'any' || familyOnly) && (
              <button
                onClick={resetFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  color: t.accent,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {str.resetFilters}
              </button>
            )}
          </div>
          <MovieGrid
          t={t}
          str={str}
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
          watchlistIds={watchlistIds}
          onToggleWatchlist={handleToggleWatchlist}
          onSelect={setSelectedMovie}
        />
        </>
      )}

      {/* Details overlay */}
      {selectedMovie && (
        <MovieDetails
          movie={selectedMovie}
          t={t}
          str={str}
          onClose={() => setSelectedMovie(null)}
          onSelectMovie={setSelectedMovie}
          isWatchlisted={watchlistIds.has(selectedMovie.id)}
          onToggleWatchlist={() => handleToggleWatchlist(selectedMovie)}
        />
      )}

      {/* Favorites drawer */}
      {favOpen && (
        <FavoritesDrawer
          t={t}
          str={str}
          items={favoriteItems}
          watchItems={watchlistItems}
          persistent={isAuthenticated}
          onClose={() => setFavOpen(false)}
          onView={(m) => {
            setSelectedMovie(m);
            setFavOpen(false);
          }}
          onRemove={handleToggleFavorite}
          onRemoveWatch={handleToggleWatchlist}
        />
      )}

      {/* Your shelf — counts from favorites / watchlist / seen */}
      {(favoriteIds.size > 0 || watchlistIds.size > 0 || excludedSet.size > 0) && (
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            padding: '6px 20px 0',
            textAlign: 'center',
            color: t.muted,
            fontSize: 13,
            display: 'flex',
            gap: 16,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {favoriteIds.size > 0 && <span>♥ {favoriteIds.size}</span>}
          {watchlistIds.size > 0 && <span>🔖 {watchlistIds.size}</span>}
          {excludedSet.size > 0 && (
            <span>
              ✓ {excludedSet.size} {str.statsSeen}
            </span>
          )}
        </div>
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
        {str.footerPowered}{' '}
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: t.accent, textDecoration: 'none' }}
        >
          TMDB
        </a>
        {str.footerNote}
      </footer>
    </div>
  );
}
