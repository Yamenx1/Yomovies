// ---------------------------------------------------------------------------
// useTasteProfile — The "For you" learner in one hook.
// Hearts (+2), watchlists (+1.5) and star ratings (+2.5 / −1.5) vote for
// their genres; the trending pool is cosine-scored against the resulting
// taste vector. Guests contribute through the local id→genres map.
// ---------------------------------------------------------------------------

import {
  buildTasteProfile,
  recommendFromProfile,
  FAVORITE_WEIGHT,
  WATCHLIST_WEIGHT,
} from '../services/recommend';

export const RATING_WEIGHT_HIGH = 2.5;
export const RATING_WEIGHT_LOW = -1.5;
const MIN_SIGNALS = 3;
const MIN_RESULTS = 4;
const MAX_RESULTS = 10;

export function useTasteProfile({
  isAuthenticated,
  favoritesList,
  watchlistList,
  ratingsList = [],
  localFavorites,
  localWatchlist,
  localRatings = {},
  guestMeta,
  viewingMovies,
  trending,
  excludedIds,
}) {
  const signals = [];
  if (isAuthenticated) {
    for (const f of favoritesList ?? []) {
      signals.push({ genre_ids: f.genre_ids, weight: FAVORITE_WEIGHT });
    }
    for (const f of watchlistList ?? []) {
      signals.push({ genre_ids: f.genre_ids, weight: WATCHLIST_WEIGHT });
    }
    for (const r of ratingsList ?? []) {
      if (r.rating >= 4) {
        signals.push({ genre_ids: r.genre_ids, weight: RATING_WEIGHT_HIGH });
      } else if (r.rating <= 2) {
        signals.push({ genre_ids: r.genre_ids, weight: RATING_WEIGHT_LOW });
      }
    }
  } else {
    const lookupGenres = (id) =>
      guestMeta[id]?.genres ?? viewingMovies.find((m) => m.id === id)?.genre_ids;
    for (const id of localFavorites) {
      signals.push({ genre_ids: lookupGenres(id), weight: FAVORITE_WEIGHT });
    }
    for (const id of localWatchlist) {
      signals.push({ genre_ids: lookupGenres(id), weight: WATCHLIST_WEIGHT });
    }
    for (const [id, r] of Object.entries(localRatings)) {
      const genres =
        guestMeta[id]?.genres ?? viewingMovies.find((m) => m.id === Number(id))?.genre_ids;
      if (r.rating >= 4) {
        signals.push({ genre_ids: genres, weight: RATING_WEIGHT_HIGH });
      } else if (r.rating <= 2) {
        signals.push({ genre_ids: genres, weight: RATING_WEIGHT_LOW });
      }
    }
  }

  const profile = buildTasteProfile(signals);
  const forYou =
    profile.count >= MIN_SIGNALS && trending.length > 0
      ? recommendFromProfile(profile, trending, excludedIds, MAX_RESULTS)
      : [];

  return {
    profile,
    forYou: forYou.length >= MIN_RESULTS ? forYou : [],
    signalCount: profile.count,
  };
}
