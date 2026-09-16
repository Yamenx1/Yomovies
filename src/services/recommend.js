// ---------------------------------------------------------------------------
// RECOMMEND — Tiny content-based recommender (no libraries).
//
// HOW IT LEARNS:
// 1. Every heart (+2) and watch-later (+1.5) votes for its genres, building
//    a taste vector: { genreId: weight }. Guests contribute the same way
//    from a local id→genres map.
// 2. Each candidate (trending pool) is scored by cosine similarity between
//    its genre set and the taste vector, plus small popularity + rating
//    boosts so obscure matches don't crowd out proven crowd-pleasers.
// ---------------------------------------------------------------------------

export const FAVORITE_WEIGHT = 2;
export const WATCHLIST_WEIGHT = 1.5;

/**
 * @param {{ genre_ids?: number[], weight: number }[]} signals
 * @returns {{ vector: Record<number, number>, count: number }}
 */
export function buildTasteProfile(signals) {
  const vector = {};
  let count = 0;
  for (const s of signals) {
    const genres = s.genre_ids ?? [];
    if (genres.length === 0) continue;
    count++;
    for (const g of genres) {
      vector[g] = (vector[g] ?? 0) + s.weight;
    }
  }
  return { vector, count };
}

function profileNorm(vector) {
  const sum = Object.values(vector).reduce((a, b) => a + b * b, 0);
  return Math.sqrt(sum) || 1;
}

/**
 * Score one candidate against the taste profile. Higher = better match.
 */
export function scoreMovie(movie, vector, norm) {
  const genres = movie.genre_ids ?? [];
  if (genres.length === 0) return -1;
  let dot = 0;
  for (const g of genres) dot += vector[g] ?? 0;
  const similarity = dot / (Math.sqrt(genres.length) * norm);
  const popularityBoost = Math.min((movie.popularity ?? 0) / 100, 1) * 0.15;
  const ratingBoost = ((movie.vote_average ?? 0) / 10) * 0.1;
  return similarity + popularityBoost + ratingBoost;
}

/**
 * @param {{ vector: Record<number, number> }} profile
 * @param {object[]} candidates - movies with genre_ids (+popularity/rating)
 * @param {Set<number>} excludeIds - already saved/seen ids
 * @param {number} limit
 * @returns {object[]} top matches, best first
 */
export function recommendFromProfile(profile, candidates, excludeIds, limit = 10) {
  const norm = profileNorm(profile.vector);
  return candidates
    .filter((m) => m.poster_path && !excludeIds.has(m.id))
    .map((m) => ({ movie: m, score: scoreMovie(m, profile.vector, norm) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.movie);
}
