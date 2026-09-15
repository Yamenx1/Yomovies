import { Sparkles, RotateCcw } from 'lucide-react';
import MovieCard from './MovieCard';
import LoadingSpinner from './LoadingSpinner';

/**
 * MovieGrid — Renders the results section:
 * - Mood description blurb
 * - Loading spinner while fetching
 * - Error message if API fails
 * - Grid of MovieCards
 * - "All excluded" fallback message
 */
export default function MovieGrid({
  t,
  movies,
  loading,
  error,
  activeMood,
  excludedCount,
  onExclude,
  onClearExcluded,
  apiReady,
  favoriteIds,
  onToggleFavorite,
}) {
  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px 80px' }}>
      {/* Mood blurb + reset button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          flexWrap: 'wrap',
          marginBottom: 28,
        }}
      >
        <p style={{ color: t.muted, fontSize: 14, margin: 0 }}>
          <Sparkles size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
          For when you're feeling {activeMood.label.toLowerCase()} — {activeMood.blurb}
        </p>
        <span
          style={{
            background: `${t.accent}18`,
            color: t.accent,
            fontSize: 11.5,
            padding: '3px 10px',
            borderRadius: 999,
            fontWeight: 600,
          }}
        >
          Fresh picks · {todayLabel}
        </span>
        {excludedCount > 0 && (
          <button
            onClick={onClearExcluded}
            style={{
              background: 'none',
              border: 'none',
              color: t.accent,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'inherit',
            }}
          >
            <RotateCcw size={12} /> {excludedCount} excluded — reset
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && <LoadingSpinner t={t} />}

      {/* Error state */}
      {error && !loading && (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: t.muted,
          }}
        >
          <p style={{ fontSize: 16, marginBottom: 8 }}>😕 Something went wrong</p>
          <p style={{ fontSize: 13, opacity: 0.7 }}>{error}</p>
          {!apiReady && (
            <p style={{ fontSize: 13, marginTop: 12, color: t.accent }}>
              Make sure your TMDB API key is set in the .env file
            </p>
          )}
        </div>
      )}

      {/* No results (all excluded) */}
      {!loading && !error && movies.length === 0 && (
        <p style={{ color: t.muted, fontSize: 14, textAlign: 'center' }}>
          You've excluded every match for this mood — try another mood, or reset your exclusions above.
        </p>
      )}

      {/* Movie grid */}
      {!loading && !error && movies.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 20,
          }}
        >
          {movies.map((movie, i) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              t={t}
              index={i}
              onExclude={onExclude}
              isFavorite={favoriteIds?.has(movie.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
