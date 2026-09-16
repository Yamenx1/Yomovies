// ---------------------------------------------------------------------------
// useMovies — Custom React Hook (surprise picks only now; AI search lives
// in the aiRecommend Convex action and reports straight to App state)
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { getTrending } from '../services/tmdb';

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
 * Totally random movies — ignores everything. Pulls a random trending page
 * and shuffles it with the given seed, so every "Surprise me" click deals a
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
