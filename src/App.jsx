// ---------------------------------------------------------------------------
// APP — Root component for Yo Movies
// ---------------------------------------------------------------------------
// This is the main component that ties everything together:
// 1. Manages theme state (dark/light)
// 2. Manages selected mood state
// 3. Fetches movies via the useMovies hook
// 4. Renders Header, MoodPicker, and MovieGrid
// ---------------------------------------------------------------------------

import { useState, useCallback } from 'react';
import THEMES from './config/theme';
import { MOODS } from './config/moods';
import { isApiKeyConfigured } from './services/tmdb';
import { useMovies } from './hooks/useMovies';
import Header from './components/Header';
import MoodPicker from './components/MoodPicker';
import MovieGrid from './components/MovieGrid';

export default function App() {
  // --- State ---
  const [theme, setTheme] = useState('dark');
  const [selectedMood, setSelectedMood] = useState(null);

  // Titles the user has already watched — excluded from results
  const [excluded, setExcluded] = useState(() => new Set());

  // Get the current theme colors
  const t = THEMES[theme];

  // Fetch movies from TMDB based on the selected mood
  const { movies, loading, error } = useMovies(selectedMood);

  // Filter out excluded movies
  const filteredMovies = movies.filter((m) => !excluded.has(m.id));

  // Find the active mood object for displaying the blurb
  const activeMood = MOODS.find((m) => m.id === selectedMood);

  // --- Callbacks ---
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleMoodSelect = useCallback((moodId) => {
    setSelectedMood(moodId);
  }, []);

  const handleExclude = useCallback((movieId) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      next.add(movieId);
      return next;
    });
  }, []);

  const handleClearExcluded = useCallback(() => {
    setExcluded(new Set());
  }, []);

  // Check if API key is configured
  const apiReady = isApiKeyConfigured();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: t.bg,
        color: t.text,
        fontFamily: "'Inter', system-ui, sans-serif",
        transition: 'background 0.25s ease, color 0.25s ease',
      }}
    >
      {/* Global styles */}
      <style>{`
        .mood-btn { transition: border-color 0.15s ease, color 0.15s ease; }
        .theme-toggle { transition: background 0.15s ease, transform 0.1s ease; }
        .theme-toggle:active { transform: scale(0.94); }
        .card {
          animation: rise 0.35s ease both;
          position: relative;
          overflow: hidden;
        }
        .card:hover { border-color: ${t.accent}44; }
        @keyframes rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) { .card { animation: none; } }
        input::placeholder { color: ${t.muted}; opacity: 0.8; }
        .exclude-btn { transition: opacity 0.15s ease, color 0.15s ease; opacity: 0.55; }
        .exclude-btn:hover { opacity: 1; color: ${t.accent}; }
        img { user-select: none; -webkit-user-drag: none; }
      `}</style>

      <Header theme={theme} t={t} onToggleTheme={toggleTheme} />

      <MoodPicker
        t={t}
        selectedMood={selectedMood}
        onMoodSelect={handleMoodSelect}
        apiReady={apiReady}
      />

      {/* Film-strip divider */}
      {selectedMood && (
        <div
          style={{
            width: '100%',
            maxWidth: 640,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`,
            margin: '48px auto 40px',
          }}
        />
      )}

      {/* Movie results */}
      {selectedMood && (
        <MovieGrid
          t={t}
          movies={filteredMovies}
          loading={loading}
          error={error}
          activeMood={activeMood}
          excludedCount={excluded.size}
          onExclude={handleExclude}
          onClearExcluded={handleClearExcluded}
          apiReady={apiReady}
        />
      )}

      {/* TMDB Attribution — required by their terms of service */}
      <footer
        style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: t.muted,
          fontSize: 12,
          opacity: 0.6,
        }}
      >
        Powered by{' '}
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: t.accent, textDecoration: 'none' }}
        >
          TMDB
        </a>
        . This product uses the TMDB API but is not endorsed or certified by TMDB.
      </footer>
    </div>
  );
}
