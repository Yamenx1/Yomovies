// ---------------------------------------------------------------------------
// TMDB API SERVICE
// ---------------------------------------------------------------------------
// This file handles ALL communication with The Movie Database (TMDB) API.
//
// HOW IT WORKS:
// 1. We read your API key from the .env file (VITE_TMDB_API_KEY)
// 2. Every function builds a URL, calls fetch(), and returns JSON
// 3. Results are cached in memory so repeated calls are instant
// 4. Poster URLs are built by combining TMDB's image CDN + poster path
//
// TMDB API docs: https://developer.themoviedb.org/docs
// ---------------------------------------------------------------------------

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

// UI language for TMDB responses ('en-US' default, 'ar-SA' for Arabic).
// Switch with setTmdbLang — the in-memory cache keys include the language.
let LANG = 'en-US';
export function setTmdbLang(lang) {
  LANG = lang;
}

// Your API key — loaded from .env file
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

// Simple in-memory cache: URL → response data
// This prevents making the same API call twice in one session
const cache = new Map();

/**
 * Core fetch helper — all TMDB calls go through here.
 *
 * @param {string} endpoint - API path like '/trending/movie/day'
 * @param {object} params   - Query parameters to add to the URL
 * @returns {Promise<object>} - Parsed JSON response
 */
async function fetchFromTMDB(endpoint, params = {}) {
  // Build the full URL with API key and parameters
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('language', LANG);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const cacheKey = url.toString();

  // Return cached result if we already fetched this exact URL
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  // Make the actual API call
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  cache.set(cacheKey, data); // Cache for future use
  return data;
}

// ---------------------------------------------------------------------------
// PUBLIC API FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Build a full image URL from a TMDB poster path.
 *
 * TMDB returns poster paths like "/abc123.jpg" — to display them,
 * you combine: base URL + size + path
 *
 * Available sizes: w92, w154, w185, w342, w500, w780, original
 *
 * @param {string} path - Poster path from TMDB (e.g., "/abc123.jpg")
 * @param {string} size - Image size (default: 'w500')
 * @returns {string|null} - Full image URL, or null if no path
 */
export function getImageUrl(path, size = 'w500') {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

/**
 * Fetch trending movies (updates daily on TMDB).
 *
 * @param {string} timeWindow - 'day' or 'week'
 * @returns {Promise<object>} - { results: [...movies], total_pages, ... }
 */
export async function getTrending(timeWindow = 'day', page = 1, kind = 'movie') {
  return fetchFromTMDB(`/trending/${kind}/${timeWindow}`, { page });
}

/**
 * Discover movies by genre — the core of our mood → movie system.
 *
 * Uses the /discover/movie endpoint which lets us filter by:
 * - Genres (OR logic with pipe separator)
 * - Minimum vote count (to filter out obscure movies)
 * - Sort order (popularity, rating, etc.)
 * - Release date range
 *
 * @param {number[]} genreIds     - Array of TMDB genre IDs
 * @param {object}   options      - Additional filtering options
 * @param {string}   options.sortBy        - Sort field (default: 'popularity.desc')
 * @param {number}   options.voteCountMin  - Minimum vote count (default: 100)
 * @param {string}   options.releaseBefore - Max release date (e.g., '2005-12-31')
 * @param {number}   options.page          - Page number (default: 1)
 * @returns {Promise<object>} - { results: [...movies], total_pages, ... }
 */
export async function discoverByGenre(genreIds, options = {}) {
  const {
    sortBy = 'popularity.desc',
    voteCountMin = 100,
    releaseBefore = '',
    page = 1,
  } = options;

  return fetchFromTMDB('/discover/movie', {
    with_genres: genreIds.join('|'),    // OR logic — any of these genres
    sort_by: sortBy,
    'vote_count.gte': voteCountMin,
    'release_date.lte': releaseBefore,
    page,
  });
}

/**
 * Get full details for a single movie.
 *
 * @param {number} movieId - TMDB movie ID
 * @returns {Promise<object>} - Full movie details
 */
export async function getMovieDetails(movieId, kind = 'movie') {
  return fetchFromTMDB(`/${kind}/${movieId}`);
}

/**
 * Get cast & crew for a single movie.
 *
 * @param {number} movieId - TMDB movie ID
 * @returns {Promise<object>} - { cast: [...], crew: [...] }
 */
export async function getMovieCredits(movieId, kind = 'movie') {
  return fetchFromTMDB(`/${kind}/${movieId}/credits`);
}

/**
 * Get videos (trailers, teasers) for a single movie.
 *
 * @param {number} movieId - TMDB movie ID
 * @returns {Promise<object>} - { results: [{ key, site, type, ... }] }
 */
export async function getMovieVideos(movieId, kind = 'movie') {
  return fetchFromTMDB(`/${kind}/${movieId}/videos`);
}

/**
 * Get streaming/rent/buy providers for a movie, by country.
 * Returns TMDB's { results: { SA: { flatrate: [...], rent, buy }, ... } }.
 */
export async function getWatchProviders(movieId, kind = 'movie') {
  return fetchFromTMDB(`/${kind}/${movieId}/watch/providers`);
}

/**
 * Pick the provider entry for the viewer's region (Saudi default,
 * with sane fallbacks). Returns { providers, region, link } — providers
 * have { provider_id, provider_name, logo_path }; link is TMDB's watch
 * page for this title+region (provider deep links aren't exposed by TMDB).
 */
export function pickProviders(watchData, region = 'SA') {
  const results = watchData?.results ?? {};
  const entry =
    results[region] ?? results.US ?? Object.values(results)[0] ?? null;
  if (!entry) return { providers: [], region, link: null };
  const seen = new Map();
  for (const p of [...(entry.flatrate ?? []), ...(entry.rent ?? []), ...(entry.buy ?? [])]) {
    if (!seen.has(p.provider_id)) seen.set(p.provider_id, p);
  }
  return { providers: [...seen.values()].slice(0, 6), region, link: entry.link ?? null };
}

/**
 * Get movies similar to the given one.
 *
 * @param {number} movieId - TMDB movie ID
 * @param {number} page - Page number (default: 1)
 * @returns {Promise<object>} - { results: [...movies] }
 */
export async function getSimilarMovies(movieId, page = 1, kind = 'movie') {
  return fetchFromTMDB(`/${kind}/${movieId}/similar`, { page });
}

/**
 * Pick the best YouTube trailer key from a videos response.
 * Prefers official Trailers, falls back to any teaser/clip.
 */
export function pickTrailerKey(videos) {
  const list = videos?.results ?? [];
  const yt = list.filter((v) => v.site === 'YouTube');
  return (
    yt.find((v) => v.type === 'Trailer' && v.official)?.key ??
    yt.find((v) => v.type === 'Trailer')?.key ??
    yt.find((v) => v.type === 'Teaser')?.key ??
    yt[0]?.key ??
    null
  );
}

/**
 * Search movies or TV shows by title.
 *
 * @param {string} query - Search query
 * @param {string} kind - 'movie' or 'tv'
 * @returns {Promise<object>} - { results: [...] }
 */
export async function searchMovies(query, kind = 'movie') {
  return fetchFromTMDB(`/search/${kind}`, { query, include_adult: 'false' });
}

/**
 * Check if the API key is configured.
 * Returns false if the key is missing or still the placeholder.
 */
export function isApiKeyConfigured() {
  return API_KEY && API_KEY !== 'YOUR_API_KEY_HERE' && API_KEY.length > 10;
}
