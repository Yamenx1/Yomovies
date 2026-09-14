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

        if (mood.useTrending) {
          // "Bored, surprise me" — use trending movies instead of genres
          data = await getTrending('week');
        } else {
          // Normal mood — discover movies by genre
          data = await discoverByGenre(mood.genreIds, {
            sortBy: mood.sortBy,
            voteCountMin: mood.voteCountMin,
            releaseBefore: mood.releaseDateBefore || '',
          });
        }

        if (!cancelled) {
          // Only keep movies that have a poster (no placeholder images)
          const withPosters = data.results.filter((m) => m.poster_path);
          setMovies(withPosters.slice(0, 12)); // Show up to 12 movies
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
