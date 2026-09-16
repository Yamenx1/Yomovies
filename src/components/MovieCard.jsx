import { Star, Heart } from 'lucide-react';
import { getImageUrl } from '../services/tmdb';

// TMDB genre ID → readable name mapping
export const GENRE_MAP = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie',
  53: 'Thriller', 10752: 'War', 37: 'Western',
};

/**
 * MovieCard — Displays a single movie with:
 * - Real poster image from TMDB
 * - Title, year, genres
 * - Star rating
 * - Plot overview
 * - "Already seen" exclude button
 *
 * HOW POSTER IMAGES WORK:
 * TMDB gives us a `poster_path` like "/abc123.jpg"
 * We combine it with their image CDN to get the full URL:
 * https://image.tmdb.org/t/p/w500/abc123.jpg
 */
export default function MovieCard({ movie, t, index, onExclude, isFavorite, onToggleFavorite, onSelect }) {
  const posterUrl = getImageUrl(movie.poster_path, 'w342');
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '—';
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '—';
  const genres = (movie.genre_ids || [])
    .map((id) => GENRE_MAP[id])
    .filter(Boolean)
    .slice(0, 3); // Show max 3 genre tags

  // Truncate overview to ~120 chars for card layout
  const overview = movie.overview
    ? movie.overview.length > 120
      ? movie.overview.slice(0, 120).trim() + '…'
      : movie.overview
    : 'No description available.';

  return (
    <div
      className="card"
      onClick={() => onSelect?.(movie)}
      title={`View details for ${movie.title}`}
      style={{
        // True glass: mostly-transparent body so the ambient backdrop pours
        // through, heavy blur + sheen + bright rim, text kept readable
        // with a soft shadow
        background: t.dark
          ? 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 45%), rgba(31,37,52,0.22)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.18) 45%), rgba(255,255,255,0.30)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        border: t.dark
          ? '1px solid rgba(255,255,255,0.18)'
          : '1px solid rgba(21,26,36,0.14)',
        boxShadow: t.dark
          ? '0 16px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)'
          : '0 16px 48px rgba(21,26,36,0.18), inset 0 1px 0 rgba(255,255,255,0.7)',
        borderRadius: 12,
        animationDelay: `${index * 50}ms`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.2s ease, transform 0.2s ease',
        cursor: onSelect ? 'pointer' : 'default',
      }}
    >
      {/* Poster */}
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={`${movie.title} poster`}
          loading="lazy"
          style={{
            width: '100%',
            aspectRatio: '2 / 3',
            objectFit: 'cover',
            borderRadius: '12px 12px 0 0',
            display: 'block',
            background: t.border,
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: '2 / 3',
            background: t.border,
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: t.muted,
            fontSize: 14,
          }}
        >
          No poster
        </div>
      )}

      {/* Info section */}
      <div
        style={{
          padding: '16px 16px 18px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          textShadow: t.dark ? '0 1px 10px rgba(0,0,0,0.55)' : 'none',
        }}
      >
        {/* Title */}
        <div
          style={{
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            fontWeight: 400,
            fontSize: 22,
            letterSpacing: 0.8,
            lineHeight: 1.1,
            marginBottom: 6,
            paddingRight: 28,
          }}
        >
          {movie.title}
        </div>

        {/* Year + Rating */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: t.muted,
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          <span>{year}</span>
          {rating !== '—' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Star size={12} fill={t.accent} stroke={t.accent} />
              {rating}
            </span>
          )}
        </div>

        {/* Genre tags */}
        {genres.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {genres.map((g) => (
              <span
                key={g}
                style={{
                  background: `${t.accent}18`,
                  color: t.accent,
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 999,
                  fontWeight: 500,
                }}
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Overview */}
        <div
          style={{
            color: t.text,
            opacity: 0.8,
            fontSize: 13.5,
            lineHeight: 1.55,
            flex: 1,
          }}
        >
          {overview}
        </div>
      </div>

      {/* Favorite button (persisted in Convex when signed in) */}
      {onToggleFavorite && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(movie);
          }}
          aria-label={isFavorite ? `Remove ${movie.title} from favorites` : `Save ${movie.title} to favorites`}
          title={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Heart
            size={14}
            fill={isFavorite ? t.accent : 'none'}
            stroke={isFavorite ? t.accent : '#fff'}
          />
        </button>
      )}

      {/* Exclude button (already seen) */}
      <button
        className="exclude-btn"
        onClick={(e) => {
          e.stopPropagation();
          onExclude(movie);
        }}
        aria-label={`Already seen ${movie.title} — exclude it`}
        title="Already seen this — exclude it"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          padding: '6px',
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
        }}
      >
        ✕
      </button>

      {/* Show exclude button on card hover */}
      <style>{`
        .card:hover .exclude-btn { opacity: 0.8 !important; }
        .card .exclude-btn:hover { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
