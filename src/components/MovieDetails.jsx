import { useState, useEffect } from 'react';
import { X, Star, Clock, Calendar, Play } from 'lucide-react';
import {
  getMovieDetails,
  getMovieCredits,
  getMovieVideos,
  getSimilarMovies,
  getImageUrl,
  pickTrailerKey,
} from '../services/tmdb';
import { GENRE_MAP } from './MovieCard';

/**
 * MovieDetails — Full-screen overlay with everything about a movie:
 * backdrop, trailer, poster, title, year, runtime, rating, genres, full
 * overview, top cast, and a "More like this" rail. Fetched live from TMDB
 * on open (cached by the tmdb service).
 */
export default function MovieDetails({ movie, t, str, onClose, onSelectMovie }) {
  const [details, setDetails] = useState(null);
  const [credits, setCredits] = useState(null);
  const [trailerKey, setTrailerKey] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [showTrailer, setShowTrailer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setShowTrailer(false);
    setTrailerKey(null);
    setSimilar([]);
    Promise.all([
      getMovieDetails(movie.id),
      getMovieCredits(movie.id),
      getMovieVideos(movie.id).catch(() => null),
      getSimilarMovies(movie.id).catch(() => null),
    ])
      .then(([d, c, v, s]) => {
        if (!cancelled) {
          setDetails(d);
          setCredits(c);
          setTrailerKey(pickTrailerKey(v));
          setSimilar(
            (s?.results ?? []).filter((m) => m.poster_path).slice(0, 10)
          );
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
          background: t.dark
            ? 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 40%), rgba(31,37,52,0.55)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.15) 40%), rgba(255,255,255,0.6)',
          backdropFilter: 'blur(30px) saturate(170%)',
          WebkitBackdropFilter: 'blur(30px) saturate(170%)',
          color: t.text,
          border: t.dark
            ? '1px solid rgba(255,255,255,0.18)'
            : '1px solid rgba(21,26,36,0.14)',
          boxShadow:
            '0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.22)',
          borderRadius: 16,
          maxWidth: 640,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Backdrop / trailer */}
        {showTrailer && trailerKey ? (
          <div style={{ width: '100%', aspectRatio: '16 / 8', background: '#000', borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>
            <iframe
              title={str.trailerOf(d.title)}
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          </div>
        ) : (
          backdropUrl && (
            <div style={{ position: 'relative' }}>
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
              {trailerKey && (
                <button
                  onClick={() => setShowTrailer(true)}
                  aria-label={str.playTrailer(d.title)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    margin: 'auto',
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    border: 'none',
                    background: `${t.accent}E6`,
                    color: '#151A24',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Play size={26} fill="#151A24" />
                </button>
              )}
            </div>
          )
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label={str.backToResults}
          title={str.backToResults}
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
            <p style={{ color: t.muted, fontSize: 14 }}>{str.detailsLoading}</p>
          )}
          {error && !loading && (
            <p style={{ color: t.muted, fontSize: 14 }}>
              {str.detailsError(error)}
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
                  fontFamily: "'Bebas Neue', 'Inter', sans-serif",
                  fontWeight: 400,
                  fontSize: 34,
                  letterSpacing: 1,
                  lineHeight: 1,
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
                {str.topCast}
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

          {/* More like this */}
          {similar.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, color: t.muted, margin: '20px 0 10px' }}>
                {str.moreLikeThis}
              </h3>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  overflowX: 'auto',
                  paddingBottom: 6,
                }}
              >
                {similar.map((s) => (
                  <img
                    key={s.id}
                    src={getImageUrl(s.poster_path, 'w185')}
                    alt={s.title}
                    title={s.title}
                    loading="lazy"
                    onClick={() => onSelectMovie?.(s)}
                    style={{
                      width: 84,
                      aspectRatio: '2 / 3',
                      objectFit: 'cover',
                      borderRadius: 8,
                      cursor: onSelectMovie ? 'pointer' : 'default',
                      flexShrink: 0,
                    }}
                  />
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
            {str.backToPicks}
          </button>
        </div>
      </div>
    </div>
  );
}
