import { useEffect, useRef } from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import MovieCard from './MovieCard';
import LoadingSpinner from './LoadingSpinner';

/**
 * MovieGrid — Renders the results section:
 * - Heading (the AI's reason line, or the Surprise label)
 * - Source badge (AI picks / Live picks)
 * - Loading spinner while fetching
 * - Error message if the search fails
 * - Grid of MovieCards
 * - "All excluded" fallback message
 */
export default function MovieGrid({
  t,
  str,
  genreMap,
  movies,
  loading,
  error,
  heading,
  badge,
  excludedCount,
  onExclude,
  onClearExcluded,
  apiReady,
  favoriteIds,
  onToggleFavorite,
  watchlistIds,
  onToggleWatchlist,
  onSelect,
  onLoadMore,
  hasMore,
  loadingMore,
}) {
  // Infinite scroll: when the sentinel scrolls into view, top up results
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { rootMargin: '600px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, movies.length]);
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px 80px' }}>
      {/* Heading + badge + reset button */}
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
        {heading && (
          <p style={{ color: t.muted, fontSize: 14, margin: 0 }}>
            <Sparkles size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
            {heading}
          </p>
        )}
        {badge && (
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
            {badge}
          </span>
        )}
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
            <RotateCcw size={12} /> {str.excludedReset(excludedCount)}
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
          <p style={{ fontSize: 16, marginBottom: 8 }}>{str.gridErrorTitle}</p>
          <p style={{ fontSize: 13, opacity: 0.7 }}>{error}</p>
          {!apiReady && (
            <p style={{ fontSize: 13, marginTop: 12, color: t.accent }}>
              {str.tmdbKeyHint}
            </p>
          )}
        </div>
      )}

      {/* No results (all excluded) */}
      {!loading && !error && movies.length === 0 && (
        <p style={{ color: t.muted, fontSize: 14, textAlign: 'center' }}>
          {str.gridEmpty}
        </p>
      )}

      {/* Movie grid */}
      {!loading && !error && movies.length > 0 && (
        <div className="movie-grid">
          {movies.map((movie, i) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              t={t}
              str={str}
              genreMap={genreMap}
              index={i}
              onExclude={onExclude}
              isFavorite={favoriteIds?.has(movie.id)}
              onToggleFavorite={onToggleFavorite}
              isWatchlisted={watchlistIds?.has(movie.id)}
              onToggleWatchlist={onToggleWatchlist}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel + explicit Load more */}
      {!loading && !error && movies.length > 0 && onLoadMore && (
        <>
          <div ref={sentinelRef} style={{ height: 1 }} />
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            {loadingMore ? (
              <span style={{ color: t.muted, fontSize: 13.5 }}>{str.loadingMore}</span>
            ) : hasMore ? (
              <button
                onClick={onLoadMore}
                style={{
                  background: 'none',
                  border: `1px solid ${t.accent}`,
                  color: t.accent,
                  borderRadius: 999,
                  padding: '9px 28px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {str.loadMore}
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
