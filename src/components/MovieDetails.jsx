import { useState, useEffect } from 'react';
import { X, Star, Clock, Calendar } from 'lucide-react';
import { getMovieDetails, getMovieCredits, getImageUrl } from '../services/tmdb';
import { GENRE_MAP } from './MovieCard';

/**
 * MovieDetails — Full-screen overlay with everything about a movie:
 * backdrop, poster, title, year, runtime, rating, genres, full overview,
 * top cast. Fetched live from TMDB on open (cached by the tmdb service).
 */
export default function MovieDetails({ movie, t, onClose }) {
  const [details, setDetails] = useState(null);
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getMovieDetails(movie.id), getMovieCredits(movie.id)])
      .then(([d, c]) => {
        if (!cancelled) {
          setDetails(d);
          setCredits(c);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [movie.id]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const d = details ?? movie;
  const backdropUrl = getImageUrl(d.backdrop_path, 'w780');
  const posterUrl = getImageUrl(d.poster_path, 'w342');
  const year = (d.release_date ?? movie.release_date)
    ? new Date(d.release_date ?? movie.release_date).getFullYear()
    : '—';
  const rating = d.vote_average ? d.vote_average.toFixed(1) : '—';
  const genres = (d.genres ?? [])
    .map((g) => g.name)
    .concat((d.genre_ids ?? []).map((id) => GENRE_MAP[id]).filter(Boolean))
    .filter((g, i, arr) => g && arr.indexOf(g) === i)
    .slice(0, 5);
  const cast = (credits?.cast ?? []).slice(0, 6);
  const runtime = d.runtime
    ? `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m`
    : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.surface,
          color: t.text,
          border: `1px solid ${t.border}`,
          borderRadius: 16,
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Backdrop */}
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt=""
            style={{
              width: '100%',
              aspectRatio: '16 / 8',
              objectFit: 'cover',
              borderRadius: '16px 16px 0 0',
              display: 'block',
            }}
          />
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Back to results"
          title="Back to results"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'rgba(0,0,0,0.6)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: 8,
            borderRadius: 999,
            display: 'flex',
          }}
        >
          <X size={16} />
        </button>

        <div style={{ padding: '20px 24px 28px' }}>
          {loading && (
            <p style={{ color: t.muted, fontSize: 14 }}>Loading details…</p>
          )}
          {error && !loading && (
            <p style={{ color: t.muted, fontSize: 14 }}>
              Couldn't load full details ({error}) — showing basic info.
            </p>
          )}

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {posterUrl && (
              <img
                src={posterUrl}
                alt={`${d.title} poster`}
                style={{
                  width: 130,
                  borderRadius: 10,
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 200 }}>
              <h2
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 24,
                  margin: '0 0 8px',
                }}
              >
                {d.title}
              </h2>
              {d.tagline && (
                <p
                  style={{
                    color: t.muted,
                    fontStyle: 'italic',
                    fontSize: 13.5,
                    margin: '0 0 10px',
                  }}
                >
                  “{d.tagline}”
                </p>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  color: t.muted,
                  fontSize: 13.5,
                  marginBottom: 10,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={13} /> {year}
                </span>
                {rating !== '—' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Star size={13} fill={t.accent} stroke={t.accent} /> {rating}
                    {d.vote_count ? ` (${d.vote_count.toLocaleString()} votes)` : ''}
                  </span>
                )}
                {runtime && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={13} /> {runtime}
                  </span>
                )}
              </div>
              {genres.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {genres.map((g) => (
                    <span
                      key={g}
                      style={{
                        background: `${t.accent}18`,
                        color: t.accent,
                        fontSize: 11.5,
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontWeight: 500,
                      }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(d.overview ?? movie.overview) && (
            <p style={{ fontSize: 14.5, lineHeight: 1.7, margin: '18px 0 0' }}>
              {d.overview ?? movie.overview}
            </p>
          )}

          {cast.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, color: t.muted, margin: '20px 0 10px' }}>
                Top cast
              </h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {cast.map((c) => (
                  <div
                    key={c.id}
                    style={{ width: 76, textAlign: 'center', fontSize: 11.5 }}
                  >
                    {c.profile_path ? (
                      <img
                        src={getImageUrl(c.profile_path, 'w185')}
                        alt={c.name}
                        loading="lazy"
                        style={{
                          width: 76,
                          height: 76,
                          objectFit: 'cover',
                          borderRadius: '50%',
                          display: 'block',
                          margin: '0 auto 6px',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 76,
                          height: 76,
                          borderRadius: '50%',
                          background: t.border,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 6px',
                          fontSize: 20,
                        }}
                      >
                        {c.name.charAt(0)}
                      </div>
                    )}
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ color: t.muted }}>{c.character}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button
            onClick={onClose}
            style={{
              marginTop: 24,
              background: t.accent,
              color: '#151A24',
              border: 'none',
              borderRadius: 8,
              padding: '10px 22px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ← Back to picks
          </button>
        </div>
      </div>
    </div>
  );
}
