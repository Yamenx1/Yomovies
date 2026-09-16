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
  const [localTheme, setLocalTheme] = useState('dark');
  const [localExcluded, setLocalExcluded] = useState(() => new Set());
  const [localFavorites, setLocalFavorites] = useState(() => readGuestSet('yo-favs'));
  const [localWatchlist, setLocalWatchlist] = useState(() => readGuestSet('yo-watch'));

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
    toggleFavorite,
    toggleWatchlist,
    clearExcluded,
    rememberGuestMeta,
    readGuestMeta,
    toDrawerItems,
  };
}
