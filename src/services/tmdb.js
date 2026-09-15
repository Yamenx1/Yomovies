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
  url.searchParams.set('language', 'en-US');
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
export async function getTrending(timeWindow = 'day', page = 1) {
  return fetchFromTMDB(`/trending/movie/${timeWindow}`, { page });
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
export async function getMovieDetails(movieId) {
  return fetchFromTMDB(`/movie/${movieId}`);
}

/**
 * Get cast & crew for a single movie.
 *
 * @param {number} movieId - TMDB movie ID
 * @returns {Promise<object>} - { cast: [...], crew: [...] }
 */
export async function getMovieCredits(movieId) {
  return fetchFromTMDB(`/movie/${movieId}/credits`);
}

/**
 * Search movies by title.
 *
 * @param {string} query - Search query
 * @returns {Promise<object>} - { results: [...movies], ... }
 */
export async function searchMovies(query) {
  return fetchFromTMDB('/search/movie', { query });
}

/**
 * Check if the API key is configured.
 * Returns false if the key is missing or still the placeholder.
 */
export function isApiKeyConfigured() {
  return API_KEY && API_KEY !== 'YOUR_API_KEY_HERE' && API_KEY.length > 10;
}
