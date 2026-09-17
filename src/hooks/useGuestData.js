// ---------------------------------------------------------------------------
// useGuestData — All signed-out (local) user state in one hook.
// Mirrors useUserData's shape (sets + drawer items + theme) so App can
// pick one source with a ternary. Hearts/watchlists persist per browser
// (id sets) plus an id→genres map that keeps teaching the taste profile
// across reloads without an account.
// ---------------------------------------------------------------------------

import { useState, useCallback } from 'react';

const GUEST_META_KEY = 'yo-meta';

function rememberGuestMeta(movie) {
  if (movie?.id == null) return;
  try {
    const meta = JSON.parse(localStorage.getItem(GUEST_META_KEY) ?? '{}');
    const prev = meta[movie.id] ?? {};
    meta[movie.id] = {
      genres: movie.genre_ids?.length ? movie.genre_ids : prev.genres,
      title: movie.title ?? prev.title,
      poster: movie.poster_path ?? prev.poster,
      kind: movie.kind ?? prev.kind ?? 'movie',
    };
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

function readGuestSet(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((n) => typeof n === 'number') : []);
  } catch {
    return new Set();
  }
}

function writeGuestSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {}
}

export function useGuestData() {
  const [localTheme, setLocalThemeState] = useState(() => {
    try {
      return localStorage.getItem('yo-theme') || 'dark';
    } catch {
      return 'dark';
    }
  });
  // Persisted so the theme survives route changes without an account
  const setLocalTheme = useCallback((theme) => {
    setLocalThemeState(theme);
    try {
      localStorage.setItem('yo-theme', theme);
    } catch {}
  }, []);
  const [localExcluded, setLocalExcluded] = useState(() => new Set());
  const [localFavorites, setLocalFavorites] = useState(() => readGuestSet('yo-favs'));
  const [localWatchlist, setLocalWatchlist] = useState(() => readGuestSet('yo-watch'));
  // Guest ratings: { [tmdbId]: { rating, review?, title?, posterPath?, genre_ids? } }
  const [localRatings, setLocalRatings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('yo-ratings') ?? '{}');
    } catch {
      return {};
    }
  });
  const setGuestRating = useCallback((tmdbId, entry) => {
    setLocalRatings((prev) => {
      const next = { ...prev };
      if (entry == null) delete next[tmdbId];
      else next[tmdbId] = entry;
      try {
        localStorage.setItem('yo-ratings', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Toggle an id in a persisted set; remembers genres for the profile
  const toggleInSet = useCallback((key, setState, movie) => {
    rememberGuestMeta(movie);
    setState((prev) => {
      const next = new Set(prev);
      if (next.has(movie.id)) next.delete(movie.id);
      else next.add(movie.id);
      writeGuestSet(key, next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(
    (movie) => toggleInSet('yo-favs', setLocalFavorites, movie),
    [toggleInSet]
  );
  const toggleWatchlist = useCallback(
    (movie) => toggleInSet('yo-watch', setLocalWatchlist, movie),
    [toggleInSet]
  );

  const clearExcluded = useCallback(() => setLocalExcluded(new Set()), []);

  // Signed-out drawer rows resolve against the movies currently on screen
  const toDrawerItems = useCallback(
    (movies, localSet) => movies.filter((m) => localSet.has(m.id)),
    []
  );

  return {
    localTheme,
    setLocalTheme,
    localExcluded,
    setLocalExcluded,
    localFavorites,
    localWatchlist,
    localRatings,
    setGuestRating,
    toggleFavorite,
    toggleWatchlist,
    clearExcluded,
    rememberGuestMeta,
    readGuestMeta,
    toDrawerItems,
  };
}
