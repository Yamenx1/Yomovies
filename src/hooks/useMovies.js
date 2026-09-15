// ---------------------------------------------------------------------------
// useMovies — Custom React Hook
// ---------------------------------------------------------------------------
// HOW CUSTOM HOOKS WORK:
// A custom hook is a function that starts with "use" and can call other
// React hooks (useState, useEffect, etc.). It lets you extract reusable
// logic from components.
//
// This hook takes a mood ID and returns { movies, loading, error }.
// Whenever the mood changes, it automatically fetches new movies.
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { getTrending, discoverByGenre } from '../services/tmdb';
import { MOODS } from '../config/moods';

// --- Daily rotation helpers -----------------------------------------------
// Picks change every calendar day: the TMDB page cycles 1..5 by day-of-year
// and results are shuffled with a seed derived from the date (YYYYMMDD),
// so every day shows a different 12-movie set for the same mood.

function daySeed(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

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
 * Fetches movies based on the selected mood.
 *
 * @param {string|null} moodId - The selected mood ID (e.g., 'cozy', 'hyped')
 * @returns {{ movies: object[], loading: boolean, error: string|null }}
 */
export function useMovies(moodId) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // useEffect runs whenever `moodId` changes
  useEffect(() => {
    // If no mood is selected, clear everything
    if (!moodId) {
      setMovies([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Find the mood config (genre IDs, sort order, etc.)
    const mood = MOODS.find((m) => m.id === moodId);
    if (!mood) return;

    // This flag prevents updating state if the component unmounts
    // or if the user switches moods before the fetch completes
    let cancelled = false;

    async function fetchMovies() {
      setLoading(true);
      setError(null);

      try {
        let data;

        // Rotate the result page every day so picks feel fresh daily
        const today = new Date();
        const page = (dayOfYear(today) % 5) + 1;

        if (mood.useTrending) {
          // "Bored, surprise me" — use trending movies instead of genres
          data = await getTrending('week', page);
        } else {
          // Normal mood — discover movies by genre
          data = await discoverByGenre(mood.genreIds, {
            sortBy: mood.sortBy,
            voteCountMin: mood.voteCountMin,
            releaseBefore: mood.releaseDateBefore || '',
            page,
          });
        }

        if (!cancelled) {
          // Only keep movies that have a poster (no placeholder images),
          // then shuffle with today's date as seed and show up to 12
          const withPosters = data.results.filter((m) => m.poster_path);
          const shuffled = shuffleSeeded(withPosters, daySeed(today));
          setMovies(shuffled.slice(0, 12)); // Show up to 12 movies
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    fetchMovies();

    // Cleanup function — runs if mood changes before fetch completes
    return () => {
      cancelled = true;
    };
  }, [moodId]); // Re-run whenever moodId changes

  return { movies, loading, error };
}
