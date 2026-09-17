import { useState, useEffect, useRef } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { X, Star, Clock, Calendar, Play } from 'lucide-react';
import StarRating from './StarRating';
import {
  getMovieDetails,
  getMovieCredits,
  getMovieVideos,
  getSimilarMovies,
  getWatchProviders,
  pickProviders,
  providerLink,
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
export default function MovieDetails({ movie, t, str, onClose, onSelectMovie, isWatchlisted, onToggleWatchlist, userRating, onRate }) {
  const [details, setDetails] = useState(null);
  const [credits, setCredits] = useState(null);
  const [trailerKey, setTrailerKey] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [providers, setProviders] = useState([]);
  const [watchLink, setWatchLink] = useState(null);
  const [jwLinks, setJwLinks] = useState([]);
  const [sharedTick, setSharedTick] = useState(false);
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
    setProviders([]);
    setWatchLink(null);
    setDetails(null);
    setCredits(null);
    const fk = movie.kind === 'tv' ? 'tv' : 'movie';
    Promise.all([
      getMovieDetails(movie.id, fk),
      getMovieCredits(movie.id, fk),
      getMovieVideos(movie.id, fk).catch(() => null),
      getSimilarMovies(movie.id, 1, fk).catch(() => null),
      getWatchProviders(movie.id, fk).catch(() => null),
    ])
      .then(([d, c, v, s, w]) => {
        if (!cancelled) {
          setDetails(d);
          setCredits(c);
          setTrailerKey(pickTrailerKey(v));
          setSimilar(
            (s?.results ?? []).filter((m) => m.poster_path).slice(0, 10)
          );
          const picked = pickProviders(w);
          setProviders(picked.providers);
          setWatchLink(picked.link);
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
  }, [movie.id, movie.kind]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus trap: keep Tab inside the dialog, return focus on unmount
  const panelRef = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    panelRef.current?.focus();
    const trap = (e) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = [...panelRef.current.querySelectorAll(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )].filter((el) => !el.disabled);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('keydown', trap);
      if (prev && prev.focus) prev.focus();
    };
  }, []);

  const d = details ?? movie;
  const kind = movie.kind === 'tv' || d.name ? 'tv' : 'movie';
  const title = d.title ?? d.name ?? movie.title;
  const getDeepLinks = useAction(api.watchLinks.deepLinks);

  // True provider deep links (JustWatch, cached server-side). Badges
  // upgrade to them when they land; fallbacks show meanwhile.
  useEffect(() => {
    let cancelled = false;
    setJwLinks([]);
    const label = d.title ?? d.name ?? movie.title;
    if (!label) return;
    getDeepLinks({ tmdbId: movie.id, title: label, kind })
      .then((r) => {
        if (!cancelled) setJwLinks(r?.links ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [movie.id, kind, getDeepLinks, d.title, d.name, movie.title]);

  function jwUrlFor(providerName) {
    const n = (providerName ?? '').toLowerCase();
    const first = n.split(' ')[0];
    const hit = jwLinks.find(
      (l) =>
        n.includes(l.provider.toLowerCase()) ||
        l.provider.toLowerCase().includes(first)
    );
    return hit?.url ?? null;
  }  const release = d.release_date ?? d.first_air_date ?? movie.release_date;
  const backdropUrl = getImageUrl(d.backdrop_path, 'w780');
  const posterUrl = getImageUrl(d.poster_path, 'w342');
  const year = release ? new Date(release).getFullYear() : '—';
  const rating = d.vote_average ? d.vote_average.toFixed(1) : '—';
  const genres = (d.genres ?? [])
    .map((g) => g.name)
    .concat((d.genre_ids ?? []).map((id) => GENRE_MAP[id]).filter(Boolean))
    .filter((g, i, arr) => g && arr.indexOf(g) === i)
    .slice(0, 5);
  const cast = (credits?.cast ?? []).slice(0, 6);
  const runtime = d.runtime
    ? `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m`
    : d.episode_run_time?.[0]
      ? `${d.episode_run_time[0]}m / ep`
      : null;
  const seasons =
    d.number_of_seasons != null
      ? `${d.number_of_seasons} ${str.seasons}`
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
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
              title={str.trailerOf(title)}
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
                  aria-label={str.playTrailer(title)}
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
                alt={`${title} poster`}
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
                {title}
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
                {seasons && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {seasons}
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
              {onRate && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <span style={{ fontSize: 13, color: t.muted }}>
                    {str.yourRating}
                  </span>
                  <StarRating value={userRating} onRate={onRate} t={t} size={20} />
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

          {/* Where to watch */}
          {providers.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, color: t.muted, margin: '20px 0 10px' }}>
                {str.whereToWatch ?? 'Where to watch'}
              </h3>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {providers.map((p) => {
                  // True JustWatch deep link when we have one for this
                  // provider, else the service search / TMDB watch fallback
                  const href =
                    jwUrlFor(p.provider_name) ??
                    providerLink(p.provider_name, title, watchLink);
                  const badge = (
                    <>
                      {p.logo_path && (
                        <img
                          src={getImageUrl(p.logo_path, 'w92')}
                          alt=""
                          style={{ width: 24, height: 24, borderRadius: 999 }}
                        />
                      )}
                      {p.provider_name}
                    </>
                  );
                  const chipStyle = {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    background: `${t.accent}12`,
                    border: `1px solid ${t.border}`,
                    borderRadius: 999,
                    padding: '4px 12px 4px 4px',
                    fontSize: 12,
                    color: t.text,
                    textDecoration: 'none',
                  };
                  return href ? (
                    <a
                      key={p.provider_id}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${p.provider_name} — open ${title} there`}
                      style={chipStyle}
                    >
                      {badge}
                    </a>
                  ) : (
                    <span key={p.provider_id} title={p.provider_name} style={chipStyle}>
                      {badge}
                    </span>
                  );
                })}
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
                    alt={s.title ?? s.name}
                    title={s.title ?? s.name}
                    loading="lazy"
                    onClick={() => onSelectMovie?.({ ...s, kind })}
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
          <button
            onClick={async () => {
              const url = window.location.href;
              const data = { title, text: title, url };
              try {
                if (navigator.share) {
                  await navigator.share(data);
                  return;
                }
                throw new Error('no-share');
              } catch {
                try {
                  await navigator.clipboard.writeText(url);
                  setSharedTick(true);
                  setTimeout(() => setSharedTick(false), 2000);
                } catch {}
              }
            }}
            style={{
              marginTop: 24,
              marginLeft: 10,
              background: 'none',
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: '10px 22px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              color: t.text,
              fontFamily: 'inherit',
            }}
          >
            {sharedTick ? str.copied : str.shareTitle}
          </button>
          {onToggleWatchlist && (
            <button
              onClick={onToggleWatchlist}
              style={{
                marginTop: 24,
                marginLeft: 10,
                background: 'none',
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                padding: '10px 22px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                color: isWatchlisted ? t.accent : t.text,
                fontFamily: 'inherit',
              }}
            >
              {isWatchlisted ? str.inWatchlist : str.watchLaterBtn}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
