// ---------------------------------------------------------------------------
// useMovies — Custom React Hook (Convex snapshots first, live TMDB fallback)
// ---------------------------------------------------------------------------
// 1. Tries the server-side daily snapshot for (moodId, date) from Convex.
//    Snapshots are written by the midnight cron, so every visitor sees the
//    same "today's picks" instantly with no TMDB call.
// 2. If no snapshot exists for that day, falls back to a live TMDB fetch
//    with the date-seeded page rotation + shuffle (same as before).
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getTrending, discoverByGenre } from '../services/tmdb';
import { MOODS } from '../config/moods';

/** Today's date in UTC (YYYY-MM-DD) — matches the cron's snapshot dates. */
export function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

// --- Daily rotation helpers (live-fallback path only) ---------------------

function dayOfYear(d = new Date()) {
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded(arr, seed) {
  const out = [...arr];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Fetches movies for a mood.
 *
 * @param {string|null} moodId - Selected mood ID (e.g., 'cozy')
 * @param {string|null} date - Snapshot date YYYY-MM-DD (defaults to today UTC)
 * @returns {{ movies: object[], loading: boolean, error: string|null,
 *            source: 'none'|'snapshot'|'live', date: string }}
 */
export function useMovies(moodId, date = null) {
  const effDate = date ?? utcToday();

  // Fresh random seed per page load — every refresh deals a new mix
  // from the day's pool (snapshot or live results alike)
  const [loadSeed] = useState(() => Math.floor(Math.random() * 1e9));

  // Snapshot path: undefined = loading, null = missing, array = hit
  const snapshot = useQuery(
    api.snapshots.get,
    moodId ? { moodId, date: effDate } : 'skip'
  );

  // Live-fallback state
  const [live, setLive] = useState({ movies: [], loading: false, error: null });
  const [useLive, setUseLive] = useState(false);

  // Reset fallback whenever the mood or date changes
  useEffect(() => {
    setUseLive(false);
    setLive({ movies: [], loading: false, error: null });
  }, [moodId, effDate]);

  // No snapshot for this day → switch to live TMDB fetch
  useEffect(() => {
    if (snapshot === null && moodId) setUseLive(true);
  }, [snapshot, moodId]);

  // Live TMDB fetch (only when the snapshot is missing)
  useEffect(() => {
    if (!useLive || !moodId) return;

    const mood = MOODS.find((m) => m.id === moodId);
    if (!mood) return;

    let cancelled = false;

    async function fetchMovies() {
      setLive((s) => ({ ...s, loading: true, error: null }));

      try {
        let data;

        // Rotate the result page every day so picks feel fresh daily
        const today = new Date();
        const page = (dayOfYear(today) % 5) + 1;

        if (mood.useTrending) {
          data = await getTrending('week', page);
        } else {
          data = await discoverByGenre(mood.genreIds, {
            sortBy: mood.sortBy,
            voteCountMin: mood.voteCountMin,
            releaseBefore: mood.releaseDateBefore || '',
            page,
          });
        }

        if (!cancelled) {
          const withPosters = data.results.filter((m) => m.poster_path);
          const shuffled = shuffleSeeded(withPosters, loadSeed);
          setLive({ movies: shuffled.slice(0, 20), loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setLive({ movies: [], loading: false, error: err.message });
        }
      }
    }

    fetchMovies();

    return () => {
      cancelled = true;
    };
  }, [useLive, moodId]);

  if (!moodId) {
    return { movies: [], loading: false, error: null, source: 'none', date: effDate };
  }

  if (!useLive) {
    if (snapshot === undefined) {
      return { movies: [], loading: true, error: null, source: 'snapshot', date: effDate };
    }
    // Deal a random 20 from the day's pool on every page load
    return {
      movies: shuffleSeeded(snapshot, loadSeed).slice(0, 20),
      loading: false,
      error: null,
      source: 'snapshot',
      date: effDate,
    };
  }

  return { ...live, source: 'live', date: effDate };
}

/**
 * Totally random movies — ignores moods. Pulls a random trending page and
 * shuffles it with the given seed, so every "Surprise me" click deals a
 * fresh hand. Pass seed=null for idle.
 */
export function useSurpriseMovies(seed) {
  const [state, setState] = useState({ movies: [], loading: false, error: null });

  useEffect(() => {
    if (seed == null) {
      setState({ movies: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ movies: [], loading: true, error: null });

    // Random page each time (TMDB trending has plenty of pages)
    const page = 1 + Math.floor(Math.random() * 10);
    getTrending('week', page)
      .then((data) => {
        if (cancelled) return;
        const withPosters = (data.results ?? []).filter((m) => m.poster_path);
        setState({
          movies: shuffleSeeded(withPosters, seed).slice(0, 24),
          loading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (!cancelled) setState({ movies: [], loading: false, error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [seed]);

  return state;
}
