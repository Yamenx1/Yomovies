// ---------------------------------------------------------------------------
// APP — Root component for Yo Movies (Clerk + Convex + TMDB + Gemini)
// ---------------------------------------------------------------------------
// Composition only: user/guest/taste state lives in useUserData,
// useGuestData and useTasteProfile. This file owns UI state (search,
// surprise, filters, overlays, language) and wires everything together.
// ---------------------------------------------------------------------------

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useConvexAuth, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import THEMES from '../config/theme';
import { isApiKeyConfigured, getTrending, getImageUrl, fetchGenreMap } from '../services/tmdb';
import { useSurpriseMovies } from '../hooks/useMovies';
import { useUserData } from '../hooks/useUserData';
import { useGuestData } from '../hooks/useGuestData';
import { useTasteProfile } from '../hooks/useTasteProfile';
import { useLang } from '../hooks/useLang';
import Header from '../components/Header';
import MoodPicker from '../components/MoodPicker';
import MovieGrid from '../components/MovieGrid';
import MovieDetails from '../components/MovieDetails';
import FavoritesDrawer from '../components/FavoritesDrawer';

export default function Home() {
  const { isAuthenticated } = useConvexAuth();
  const user = useUserData();
  const guest = useGuestData();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: urlMovieId } = useParams();
  // /tv/:id deep links carry the kind in the path; /movie/:id is movies
  const urlKind = location.pathname.startsWith('/tv/') ? 'tv' : 'movie';

  // --- Language (persisted per browser, flips RTL + TMDB language) ---
  const { lang, str, toggleLang } = useLang();

  // --- Content kind: movies or TV shows (persisted, drives AI + feeds) ---
  const [kind, setKindState] = useState(() => {
    try {
      return localStorage.getItem('yo-kind') === 'tv' ? 'tv' : 'movie';
    } catch {
      return 'movie';
    }
  });
  const changeKind = useCallback((next) => {
    setKindState(next);
    try {
      localStorage.setItem('yo-kind', next);
    } catch {}
  }, []);

  // AI search results (null = nothing searched yet; query+kind kept so
  // "load more" can top up the same search)
  const [search, setSearch] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const recommendMore = useAction(api.aiRecommend.recommend);

  // Localized genre names (Arabic tags when lang === 'ar')
  const [genreMap, setGenreMap] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchGenreMap(lang === 'ar' ? 'ar-SA' : 'en-US').then((m) => {
      if (!cancelled) setGenreMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  // Random picks surprise (null = off). A fresh seed redeals the hand.
  const [surpriseSeed, setSurpriseSeed] = useState(null);
  const surprise = useSurpriseMovies(surpriseSeed, kind);

  // Opened movie (details overlay). Null = grid view.
  // The overlay is route-driven: /movie/:id opens it (shareable URL),
  // back button / close returns to '/'. Direct visits fetch by id.
  const [selectedMovie, setSelectedMovie] = useState(null);
  const openMovie = useCallback((movie) => {
    if (!movie) return;
    const k = movie.kind === 'tv' ? 'tv' : 'movie';
    setSelectedMovie(movie);
    navigate(`/${k}/${movie.id}`);
  }, [navigate]);
  const closeMovie = useCallback(() => {
    setSelectedMovie(null);
    navigate('/');
  }, [navigate]);
  useEffect(() => {
    if (urlMovieId) {
      const nid = Number(urlMovieId);
      if (!Number.isNaN(nid)) {
        setSelectedMovie((prev) =>
          prev?.id === nid && (prev.kind ?? 'movie') === urlKind
            ? prev
            : { id: nid, kind: urlKind }
        );
      }
    } else {
      setSelectedMovie(null);
    }
  }, [urlMovieId, urlKind]);

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
    setTrending([]);
    Promise.all([getTrending('week', 1, kind), getTrending('week', 2, kind)])
      .then(([a, b]) => {
        if (cancelled) return;
        const seen = new Map();
        for (const m of [...(a.results ?? []), ...(b.results ?? [])]) {
          if (m.poster_path && !seen.has(m.id)) seen.set(m.id, { ...m, kind });
        }
        setTrending([...seen.values()].slice(0, 18));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [kind]);
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

  // --- Unified data source: Convex when signed in, local when not ---
  const themeName =
    isAuthenticated && user.themeName ? user.themeName : guest.localTheme;
  const excludedSet = isAuthenticated ? user.excludedIds : guest.localExcluded;
  const favoriteIds = isAuthenticated ? user.favoriteIds : guest.localFavorites;
  const watchlistIds = isAuthenticated ? user.watchlistIds : guest.localWatchlist;

  const t = THEMES[themeName] ?? THEMES.dark;

  // What the grid shows: surprise hand wins, otherwise the latest search
  const isSurprise = surpriseSeed != null;
  const searchView =
    search == null
      ? { movies: [], loading: false, error: null, heading: null, badge: null }
      : {
          movies: search.movies,
          loading: search.loading,
          error: search.error,
          heading: search.reason,
          badge: str.badgeAi,
        };
  const viewing = isSurprise
    ? {
        movies: surprise.movies,
        loading: surprise.loading,
        error: surprise.error,
        heading: str.surpriseHeading,
        badge: str.badgeLive,
      }
    : searchView;

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

  // --- "For you" learner (hearts + watchlist + ratings, guests included) ---
  const { forYou } = useTasteProfile({
    isAuthenticated,
    favoritesList: user.favoritesList,
    watchlistList: user.watchlistList,
    ratingsList: user.ratingsList,
    localFavorites: guest.localFavorites,
    localWatchlist: guest.localWatchlist,
    localRatings: guest.localRatings,
    guestMeta: guest.readGuestMeta(),
    viewingMovies: viewing.movies,
    trending,
    excludedIds: new Set([...favoriteIds, ...watchlistIds, ...excludedSet]),
  });

  // Rate a movie 1–5 ( null clears ). Feeds the taste profile.
  const handleRate = useCallback((movie, rating) => {
    if (isAuthenticated) {
      if (rating == null) {
        user.mutations.removeRating({ tmdbId: movie.id }).catch(() => {});
      } else {
        user.mutations
          .setRating({
            tmdbId: movie.id,
            title: movie.title,
            posterPath: movie.poster_path ?? undefined,
            kind: movie.kind ?? kind,
            genreIds: movie.genre_ids ?? undefined,
            rating,
          })
          .catch(() => {});
      }
    } else {
      guest.setGuestRating(
        movie.id,
        rating == null
          ? null
          : {
              rating,
              title: movie.title,
              posterPath: movie.poster_path ?? null,
              genre_ids: movie.genre_ids ?? [],
              kind: movie.kind ?? kind,
            }
      );
    }
  }, [isAuthenticated, user, guest, kind]);

  const ratingFor = useCallback((movieId) => {
    if (movieId == null) return null;
    if (isAuthenticated) {
      return user.ratingsList?.find((r) => r.tmdbId === movieId)?.rating ?? null;
    }
    return guest.localRatings[movieId]?.rating ?? null;
  }, [isAuthenticated, user.ratingsList, guest.localRatings]);

  const favoriteItems = isAuthenticated
    ? user.favoriteItems
    : guest.toDrawerItems(viewing.movies, guest.localFavorites);
  const watchlistItems = isAuthenticated
    ? user.watchlistItems
    : guest.toDrawerItems(viewing.movies, guest.localWatchlist);

  // --- Callbacks ---
  const toggleTheme = useCallback(() => {
    const next =
      (isAuthenticated && user.themeName ? user.themeName : guest.localTheme) === 'dark'
        ? 'light'
        : 'dark';
    guest.setLocalTheme(next);
    if (isAuthenticated) user.mutations.setPrefs({ theme: next }).catch(() => {});
  }, [isAuthenticated, user, guest]);

  // AI search completed in MoodPicker — show its movies
  const handleResults = useCallback((results) => {
    setSearch({ ...results, loading: false, error: null });
    setHasMore(true);
    closeMovie(); // close any open details
    setSurpriseSeed(null); // leave surprise mode
    resetFilters();
  }, [resetFilters, closeMovie]);

  // Infinite scroll / Load more: top up the SAME search, excluding shown
  const loadMore = useCallback(async () => {
    if (isSurprise || !search?.query || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await recommendMore({
        text: search.query,
        lang,
        kind: search.kind ?? 'movie',
        excludeTitles: search.movies.map((m) => m.title),
      });
      const fresh = (res.movies ?? []).filter(
        (m) => !search.movies.some((s) => s.id === m.id)
      );
      if (fresh.length === 0) {
        setHasMore(false);
        return;
      }
      setSearch((prev) => ({ ...prev, movies: [...prev.movies, ...fresh] }));
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [isSurprise, search, loadingMore, hasMore, recommendMore, lang]);

  const handleSearchLoading = useCallback((loading) => {
    setSearch((prev) => ({ ...(prev ?? { movies: [] }), loading, error: null }));
    if (loading) {
      closeMovie();
      setSurpriseSeed(null);
    }
  }, [closeMovie]);

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
    closeMovie();
    resetFilters();
    setSurpriseSeed(Date.now());
  }, [resetFilters, closeMovie]);

  // Logo / site name → back to the main menu
  const handleHome = useCallback(() => {
    setSearch(null);
    closeMovie();
    setSurpriseSeed(null);
    resetFilters();
  }, [resetFilters, closeMovie]);

  const handleExclude = useCallback(
    (movie) => {
      const tmdbId = typeof movie === 'object' ? movie.id : movie;
      const title = typeof movie === 'object' ? movie.title : undefined;
      if (isAuthenticated) {
        user.mutations.addWatched({ tmdbId, title }).catch(() => {});
      } else {
        guest.setLocalExcluded((prev) => {
          const next = new Set(prev);
          next.add(tmdbId);
          return next;
        });
      }
    },
    [isAuthenticated, user, guest]
  );

  const handleClearExcluded = useCallback(() => {
    guest.clearExcluded();
    if (isAuthenticated) user.mutations.clearWatched().catch(() => {});
  }, [isAuthenticated, user, guest]);

  const handleToggleFavorite = useCallback(
    (movie) => {
      if (isAuthenticated) {
        if (favoriteIds.has(movie.id)) {
          user.mutations.removeFavorite({ tmdbId: movie.id }).catch(() => {});
        } else {
          user.mutations
            .addFavorite({
              tmdbId: movie.id,
              title: movie.title,
              posterPath: movie.poster_path ?? undefined,
              kind: movie.kind ?? kind,
              genreIds: movie.genre_ids ?? undefined,
            })
            .catch(() => {});
        }
      } else {
        guest.toggleFavorite(movie);
      }
    },
    [isAuthenticated, favoriteIds, user, guest, kind]
  );

  const handleToggleWatchlist = useCallback(
    (movie) => {
      if (isAuthenticated) {
        if (watchlistIds.has(movie.id)) {
          user.mutations.removeWatchlist({ tmdbId: movie.id }).catch(() => {});
        } else {
          user.mutations
            .addWatchlist({
              tmdbId: movie.id,
              title: movie.title,
              posterPath: movie.poster_path ?? undefined,
              kind: movie.kind ?? kind,
              genreIds: movie.genre_ids ?? undefined,
            })
            .catch(() => {});
        }
      } else {
        guest.toggleWatchlist(movie);
      }
    },
    [isAuthenticated, watchlistIds, user, guest, kind]
  );

  // Check if API key is configured
  const apiReady = isApiKeyConfigured();

  const favoritesForRow =
    isAuthenticated && user.favoritesList
      ? user.favoritesList
      : viewing.movies.filter((m) => guest.localFavorites.has(m.id));

  // Ambient backdrop: blurred backdrops of the movies on screen, so the
  // whole page mirrors the current picks. Low-res is plenty when blurred.
  const ambient = viewing.movies
    .filter((m) => m.backdrop_path)
    .slice(0, 3);
  const ambientKey = ambient.map((m) => m.id).join(',');

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
        kind={kind}
        onKindChange={changeKind}
        onResults={handleResults}
        onSearchLoading={handleSearchLoading}
        onSearchError={handleSearchError}
        onSurprise={handleSurprise}
        onSelectMovie={openMovie}
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
                onClick={() => openMovie(m)}
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
                onClick={() => openMovie(m)}
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
            genreMap={genreMap}
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
          onSelect={openMovie}
          onLoadMore={isSurprise ? undefined : loadMore}
          hasMore={hasMore}
          loadingMore={loadingMore}
        />
        </>
      )}

      {/* Details overlay — route-driven so /movie/:id is shareable and
          the back button closes it. Prefetched card data is used when the
          overlay was opened in-app; a bare { id } fetches everything. */}
      {urlMovieId && (() => {
        const nid = Number(urlMovieId);
        const movie =
          selectedMovie?.id === nid ? selectedMovie : { id: nid };
        return (
          <MovieDetails
            movie={movie}
            t={t}
            str={str}
            onClose={closeMovie}
            onSelectMovie={openMovie}
            isWatchlisted={watchlistIds.has(movie.id)}
            onToggleWatchlist={() => handleToggleWatchlist(movie)}
            userRating={ratingFor(movie.id)}
            onRate={(rating) => handleRate(movie, rating)}
          />
        );
      })()}

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
            openMovie(m);
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
