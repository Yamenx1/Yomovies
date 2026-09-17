// ---------------------------------------------------------------------------
// useUserData — All signed-in (Convex) user state in one hook.
// Returns raw lists, mutations, derived id sets, and drawer-ready items.
// While signed out (or still loading) lists are null/[] and sets are empty.
// ---------------------------------------------------------------------------

import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function useUserData() {
  const { isAuthenticated } = useConvexAuth();

  const prefs = useQuery(api.preferences.get);
  const watchedList = useQuery(api.watched.list);
  const favoritesList = useQuery(api.favorites.list);
  const watchlistList = useQuery(api.watchlist.list);
  const ratingsList = useQuery(api.ratings.list);

  const setPrefs = useMutation(api.preferences.set);
  const addWatched = useMutation(api.watched.add);
  const removeWatched = useMutation(api.watched.remove);
  const clearWatched = useMutation(api.watched.clear);
  const addFavorite = useMutation(api.favorites.add);
  const removeFavorite = useMutation(api.favorites.remove);
  const addWatchlist = useMutation(api.watchlist.add);
  const removeWatchlist = useMutation(api.watchlist.remove);
  const setRating = useMutation(api.ratings.set);
  const removeRating = useMutation(api.ratings.remove);

  const toIds = (rows) => new Set((rows ?? []).map((r) => r.tmdbId));

  // Drawer rows need poster/title — Convex rows carry them
  const toDrawerItems = (rows) =>
    (rows ?? []).map((f) => ({
      id: f.tmdbId,
      kind: f.kind ?? 'movie',
      title: f.title,
      poster_path: f.posterPath ?? null,
      release_date: null,
      vote_average: null,
      genre_ids: f.genre_ids ?? [],
    }));

  return {
    isAuthenticated,
    prefs,
    watchedList,
    favoritesList,
    watchlistList,
    ratingsList,
    mutations: {
      setPrefs,
      addWatched,
      removeWatched,
      clearWatched,
      addFavorite,
      removeFavorite,
      addWatchlist,
      removeWatchlist,
      setRating,
      removeRating,
    },
    excludedIds: toIds(watchedList),
    favoriteIds: toIds(favoritesList),
    watchlistIds: toIds(watchlistList),
    favoriteItems: toDrawerItems(favoritesList),
    watchlistItems: toDrawerItems(watchlistList),
    themeName: prefs?.theme ?? null,
  };
}
