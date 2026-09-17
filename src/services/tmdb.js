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

// The TMDB key lives ONLY in Convex (see convex/tmdb.js). Browsers call
// the proxy action, so the key never ships in the JS bundle. App injects
// the caller once at startup via setTmdbCaller.
let caller = null;
export function setTmdbCaller(fn) {
  caller = fn;
}

// Simple in-memory cache: URL → response data
// This prevents making the same API call twice in one session
const cache = new Map();

// sessionStorage tier (10-min TTL) so repeat visits don't re-hit TMDB.
// Everything is wrapped in try/catch — private mode etc. must never break us.
const CACHE_TTL = 10 * 60 * 1000;
function readSessionCache(key) {
  try {
    const raw = sessionStorage.getItem(`tmdb:${key}`);
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (!t || Date.now() - t > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}
function writeSessionCache(key, data) {
  try {
    sessionStorage.setItem(`tmdb:${key}`, JSON.stringify({ t: Date.now(), data }));
  } catch {}
}

/**
 * Core fetch helper — all TMDB calls go through here.
 *
 * @param {string} endpoint - API path like '/trending/movie/day'
 * @param {object} params   - Query parameters to add to the URL
 * @returns {Promise<object>} - Parsed JSON response
 */
async function fetchFromTMDB(endpoint, params = {}) {
  // Build the cache key (no secrets in it — key stays server-side)
  const url = new URL(`${BASE_URL}${endpoint}`);
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
  const sessionHit = readSessionCache(cacheKey);
  if (sessionHit) {
    cache.set(cacheKey, sessionHit);
    return sessionHit;
  }

  // Server-side call through the Convex proxy (key never leaves Convex)
  if (!caller) {
    throw new Error('Movie service is still starting — reload the app');
  }
  const data = await caller({ endpoint, params: { ...params, language: LANG } });
  cache.set(cacheKey, data);
  writeSessionCache(cacheKey, data);
  return data;
}

/**
 * Localized genre id → name map (TMDB translates these).
 * Cached per language; falls back to null on any failure.
 */
const genreMapCache = {};
export async function fetchGenreMap(lang = 'en-US') {
  if (genreMapCache[lang]) return genreMapCache[lang];
  try {
    const [movie, tv] = await Promise.all([
      fetchFromTMDB('/genre/movie/list', { language: lang }),
      fetchFromTMDB('/genre/tv/list', { language: lang }),
    ]);
    const map = {};
    for (const g of [...(movie.genres ?? []), ...(tv.genres ?? [])]) {
      map[g.id] = g.name;
    }
    genreMapCache[lang] = map;
    return map;
  } catch {
    return null;
  }
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
 * Direct service links. TMDB exposes no per-title provider deep links, so
 * for services with a stable public search URL we link straight into
 * their own search for the title; everything else falls back to TMDB.
 */
const PROVIDER_SEARCH = [
  { match: ['netflix'], url: (t) => `https://www.netflix.com/search?q=${encodeURIComponent(t)}` },
  { match: ['prime video', 'amazon'], url: (t) => `https://www.primevideo.com/search?phrase=${encodeURIComponent(t)}` },
  { match: ['disney'], url: (t) => `https://www.disneyplus.com/search?q=${encodeURIComponent(t)}` },
  { match: ['apple tv', 'itunes'], url: (t) => `https://tv.apple.com/search?term=${encodeURIComponent(t)}` },
  { match: ['youtube'], url: (t) => `https://www.youtube.com/results?search_query=${encodeURIComponent(t + ' full movie')}` },
  { match: ['google play'], url: (t) => `https://play.google.com/store/search?q=${encodeURIComponent(t)}&c=movies` },
  { match: ['hulu'], url: (t) => `https://www.hulu.com/search?q=${encodeURIComponent(t)}` },
];

export function providerLink(providerName, title, fallback) {
  const name = (providerName ?? '').toLowerCase();
  const rule = PROVIDER_SEARCH.find((r) => r.match.some((m) => name.includes(m)));
  return rule ? rule.url(title) : (fallback ?? null);
}
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
 * Normalize a TMDB movie OR tv object to the app's card shape.
 * TV results use `name` / `first_air_date` — this maps them onto the
 * `title` / `release_date` fields every component reads.
 */
export function normalizeMedia(m, kind = 'movie') {
  if (!m) return m;
  return {
    ...m,
    kind,
    title: m.title ?? m.name ?? 'Untitled',
    release_date: m.release_date ?? m.first_air_date ?? null,
  };
}

/**
 * The key lives server-side now, so the client is always "configured".
 * Kept for its callers (the .env warning UI stays dormant).
 */
export function isApiKeyConfigured() {
  return true;
}
