// ---------------------------------------------------------------------------
// PROFILE PAGE — Library, Ratings, Insights (/profile).
// Signed in: everything comes from Convex. Guest: same UI backed by the
// local shelves (yo-favs / yo-watch / yo-ratings / yo-meta + seen ids).
// ---------------------------------------------------------------------------

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import THEMES from '../config/theme';
import { useUserData } from '../hooks/useUserData';
import { useGuestData } from '../hooks/useGuestData';
import { useLang } from '../hooks/useLang';
import { buildTasteProfile } from '../services/recommend';
import { getImageUrl } from '../services/tmdb';
import { GENRE_MAP } from '../components/MovieCard';
import StarRating from '../components/StarRating';

function readLocalRecent() {
  try {
    const raw = localStorage.getItem('yo-recent-searches');
    const list = JSON.parse(raw ?? '[]');
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function ShelfRow({ t, str, item, checked, onToggleCheck, onRemove, onView, extra, selectable = true }) {
  const poster = getImageUrl(item.poster_path, 'w92');
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 10px',
        borderRadius: 10,
        border: `1px solid transparent`,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggleCheck}
        aria-label={str.selectAll}
        style={{
          width: 16,
          height: 16,
          accentColor: t.accent,
          flexShrink: 0,
          visibility: selectable ? 'visible' : 'hidden',
        }}
      />
      {poster ? (
        <img
          src={poster}
          alt=""
          loading="lazy"
          onClick={onView ? () => onView(item) : undefined}
          style={{
            width: 40,
            borderRadius: 6,
            flexShrink: 0,
            cursor: onView ? 'pointer' : 'default',
          }}
        />
      ) : (
        <div style={{ width: 40, height: 60, borderRadius: 6, background: t.border, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          onClick={onView ? () => onView(item) : undefined}
          style={{
            fontWeight: 600,
            fontSize: 14,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            cursor: onView ? 'pointer' : 'default',
          }}
        >
          {item.title ?? `#${item.id}`}
        </div>
        {extra}
      </div>
      <button
        onClick={onRemove}
        style={{
          background: 'none',
          border: `1px solid ${t.border}`,
          color: t.muted,
          borderRadius: 8,
          padding: '5px 12px',
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();
  const user = useUserData();
  const guest = useGuestData();
  const { lang, str, toggleLang } = useLang();

  const themeName =
    isAuthenticated && user.themeName ? user.themeName : guest.localTheme;
  const t = THEMES[themeName] ?? THEMES.dark;

  const [tab, setTab] = useState('library');
  const [section, setSection] = useState('favorites');
  const [checked, setChecked] = useState(() => new Set());
  const [drafts, setDrafts] = useState({});
  const [savedTick, setSavedTick] = useState(null);

  const serverRecent = useQuery(api.recent.list);

  // Unified rows: { id, title, poster_path, genre_ids, rating?, review? }
  const guestMeta = guest.readGuestMeta();
  const metaRow = (id) => ({
    id,
    kind: guestMeta[id]?.kind ?? 'movie',
    title: guestMeta[id]?.title ?? `#${id}`,
    poster_path: guestMeta[id]?.poster ?? null,
    genre_ids: guestMeta[id]?.genres ?? [],
  });

  const favRows = isAuthenticated
    ? (user.favoritesList ?? []).map((f) => ({
        id: f.tmdbId,
        kind: f.kind ?? 'movie',
        title: f.title,
        poster_path: f.posterPath ?? null,
        genre_ids: f.genre_ids ?? [],
      }))
    : [...guest.localFavorites].map(metaRow);
  const watchRows = isAuthenticated
    ? (user.watchlistList ?? []).map((f) => ({
        id: f.tmdbId,
        kind: f.kind ?? 'movie',
        title: f.title,
        poster_path: f.posterPath ?? null,
        genre_ids: f.genre_ids ?? [],
      }))
    : [...guest.localWatchlist].map(metaRow);
  const seenRows = isAuthenticated
    ? (user.watchedList ?? []).map((w) => ({
        id: w.tmdbId,
        title: w.title ?? `#${w.tmdbId}`,
        poster_path: null,
        genre_ids: [],
      }))
    : [...guest.localExcluded].map(metaRow);
  const ratingRows = isAuthenticated
    ? (user.ratingsList ?? []).map((r) => ({
        id: r.tmdbId,
        kind: r.kind ?? 'movie',
        title: r.title,
        poster_path: r.posterPath ?? null,
        genre_ids: r.genre_ids ?? [],
        rating: r.rating,
        review: r.review ?? '',
      }))
    : Object.entries(guest.localRatings).map(([id, r]) => ({
        id: Number(id),
        kind: r.kind ?? guestMeta[id]?.kind ?? 'movie',
        title: r.title ?? guestMeta[id]?.title ?? `#${id}`,
        poster_path: r.posterPath ?? guestMeta[id]?.poster ?? null,
        genre_ids: r.genre_ids ?? guestMeta[id]?.genres ?? [],
        rating: r.rating,
        review: r.review ?? '',
      }));

  const sections = {
    favorites: favRows,
    watchlist: watchRows,
    seen: seenRows,
  };
  const rows = sections[section] ?? [];
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.id));

  // Open details for a row (kind-aware route)
  function viewItem(item) {
    navigate(`/${item.kind === 'tv' ? 'tv' : 'movie'}/${item.id}`);
  }

  function toggleCheck(id) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeRow(id) {
    if (section === 'favorites') {
      if (isAuthenticated) user.mutations.removeFavorite({ tmdbId: id }).catch(() => {});
      else guest.toggleFavorite({ id });
    } else if (section === 'watchlist') {
      if (isAuthenticated) user.mutations.removeWatchlist({ tmdbId: id }).catch(() => {});
      else guest.toggleWatchlist({ id });
    } else {
      if (isAuthenticated) user.mutations.removeWatched({ tmdbId: id }).catch(() => {});
      else {
        guest.setLocalExcluded((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
    setChecked((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function removeSelected() {
    [...checked].forEach((id) => removeRow(id));
    setChecked(new Set());
  }

  function clearSection() {
    rows.forEach((r) => removeRow(r.id));
    setChecked(new Set());
  }

  function setRating(id, rating, base) {
    if (isAuthenticated) {
      if (rating == null) {
        user.mutations.removeRating({ tmdbId: id }).catch(() => {});
      } else {
        user.mutations
          .setRating({
            tmdbId: id,
            title: base.title ?? `#${id}`,
            posterPath: base.poster_path ?? undefined,
            kind: base.kind ?? 'movie',
            genreIds: base.genre_ids ?? undefined,
            rating,
          })
          .catch(() => {});
      }
    } else {
      const prev = guest.localRatings[id];
      guest.setGuestRating(
        id,
        rating == null
          ? null
          : {
              rating,
              title: base.title ?? prev?.title,
              posterPath: base.poster_path ?? prev?.posterPath ?? null,
              kind: base.kind ?? prev?.kind ?? 'movie',
              genre_ids: base.genre_ids ?? prev?.genre_ids ?? [],
              review: prev?.review,
            }
      );
    }
  }

  function saveReview(id, base) {
    const text = (drafts[id] ?? '').trim().slice(0, 500);
    if (isAuthenticated) {
      const existing = (user.ratingsList ?? []).find((r) => r.tmdbId === id);
      user.mutations
        .setRating({
          tmdbId: id,
          title: base.title ?? `#${id}`,
          posterPath: base.poster_path ?? undefined,
          kind: base.kind ?? 'movie',
          genreIds: base.genre_ids ?? undefined,
          rating: existing?.rating ?? 3,
          review: text || undefined,
        })
        .catch(() => {});
    } else {
      const prev = guest.localRatings[id] ?? {};
      guest.setGuestRating(id, {
        ...prev,
        title: base.title ?? prev.title,
        kind: base.kind ?? prev.kind ?? 'movie',
        review: text || undefined,
        rating: prev.rating ?? 3,
      });
    }
    setSavedTick(id);
    setTimeout(() => setSavedTick((cur) => (cur === id ? null : cur)), 1500);
  }

  // Insights: top genres from the same signals the recommender uses
  const insights = useMemo(() => {
    const signals = [];
    for (const r of favRows) signals.push({ genre_ids: r.genre_ids, weight: 2 });
    for (const r of watchRows) signals.push({ genre_ids: r.genre_ids, weight: 1.5 });
    for (const r of ratingRows) {
      if (r.rating >= 4) signals.push({ genre_ids: r.genre_ids, weight: 2.5 });
      else if (r.rating <= 2) signals.push({ genre_ids: r.genre_ids, weight: -1.5 });
    }
    const { vector } = buildTasteProfile(signals);
    const top = Object.entries(vector)
      .filter(([, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const max = top.length ? top[0][1] : 1;
    const avg =
      ratingRows.length > 0
        ? ratingRows.reduce((a, r) => a + r.rating, 0) / ratingRows.length
        : null;
    return { top, max, avg };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favRows.length, watchRows.length, ratingRows.length, ratingRows.map((r) => r.rating).join(',')]);

  const recentSearches =
    isAuthenticated && serverRecent ? serverRecent : !isAuthenticated ? readLocalRecent() : [];

  const tabBtn = (id, label) => (
    <button
      key={id}
      onClick={() => {
        setTab(id);
        setChecked(new Set());
      }}
      style={{
        flex: 1,
        background: tab === id ? `${t.accent}22` : 'none',
        border: `1px solid ${tab === id ? t.accent : t.border}`,
        color: tab === id ? t.text : t.muted,
        borderRadius: 999,
        padding: '8px 10px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: t.bg,
        color: t.text,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Slim header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 960,
          margin: '0 auto',
          padding: '24px 20px 0',
        }}
      >
        <div
          onClick={() => navigate('/')}
          title={str.homeTitle}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <img src={t.logo} alt="Yo Movies logo" style={{ height: 40, width: 'auto', display: 'block' }} />
          <span style={{ fontFamily: "'Bebas Neue', 'Inter', sans-serif", fontSize: 22, letterSpacing: 2 }}>
            Yo Movies
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={toggleLang}
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 999,
              minWidth: 38,
              height: 38,
              padding: '0 10px',
              color: t.text,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {str.langName}
          </button>
          <button
            onClick={() => navigate('/')}
            style={{
              background: t.accent,
              color: '#151A24',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {str.backHome}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px 80px' }}>
        <h1
          style={{
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            fontSize: 44,
            letterSpacing: 2,
            margin: '0 0 6px',
          }}
        >
          {str.profileTitle}
        </h1>
        {!isAuthenticated && (
          <p style={{ color: t.muted, fontSize: 13.5, margin: '0 0 18px' }}>
            {str.guestLibraryNote}
          </p>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {tabBtn('library', str.tabLibrary)}
          {tabBtn('ratings', `${str.tabRatings} (${ratingRows.length})`)}
          {tabBtn('insights', str.tabInsights)}
        </div>

        {/* LIBRARY TAB */}
        {tab === 'library' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { id: 'favorites', label: `${str.favTab} (${favRows.length})` },
                { id: 'watchlist', label: `${str.watchTab} (${watchRows.length})` },
                { id: 'seen', label: `${str.seenSection} (${seenRows.length})` },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSection(s.id);
                    setChecked(new Set());
                  }}
                  style={{
                    background: section === s.id ? `${t.accent}22` : 'none',
                    border: `1px solid ${section === s.id ? t.accent : t.border}`,
                    color: section === s.id ? t.text : t.muted,
                    borderRadius: 999,
                    padding: '7px 14px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {rows.length === 0 ? (
              <p style={{ color: t.muted, fontSize: 14, textAlign: 'center', marginTop: 40 }}>
                {str.emptyShelf}
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 12.5, color: t.muted, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={() =>
                        setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.id)))
                      }
                      style={{ accentColor: t.accent }}
                    />
                    {str.selectAll}
                  </label>
                  <div style={{ flex: 1 }} />
                  {checked.size > 0 && (
                    <button
                      onClick={removeSelected}
                      style={{
                        background: 'none',
                        border: `1px solid ${t.accent}`,
                        color: t.accent,
                        borderRadius: 8,
                        padding: '6px 14px',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {str.removeSelected} ({checked.size})
                    </button>
                  )}
                  <button
                    onClick={clearSection}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: t.muted,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {str.clearAll}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {rows.map((r) => (
                    <ShelfRow
                      key={r.id}
                      t={t}
                      str={str}
                      item={r}
                      checked={checked.has(r.id)}
                      onToggleCheck={() => toggleCheck(r.id)}
                      onRemove={() => removeRow(r.id)}
                      onView={viewItem}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* RATINGS TAB */}
        {tab === 'ratings' && (
          <>
            {ratingRows.length === 0 ? (
              <p style={{ color: t.muted, fontSize: 14, textAlign: 'center', marginTop: 40 }}>
                {str.emptyShelf}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ratingRows.map((r) => (
                  <div key={r.id}>
                    <ShelfRow
                      t={t}
                      str={str}
                      item={r}
                      selectable={false}
                      checked={false}
                      onToggleCheck={() => {}}
                      onView={viewItem}
                      onRemove={() => {
                        if (isAuthenticated) {
                          user.mutations.removeRating({ tmdbId: r.id }).catch(() => {});
                        } else {
                          guest.setGuestRating(r.id, null);
                        }
                      }}
                      extra={
                        <StarRating
                          value={r.rating}
                          t={t}
                          size={17}
                          onRate={(v) => {
                            if (isAuthenticated) {
                              if (v == null) user.mutations.removeRating({ tmdbId: r.id }).catch(() => {});
                              else {
                                user.mutations
                                  .setRating({
                                    tmdbId: r.id,
                                    title: r.title,
                                    posterPath: r.poster_path ?? undefined,
                                    genreIds: r.genre_ids ?? undefined,
                                    rating: v,
                                  })
                                  .catch(() => {});
                              }
                            } else {
                              const prev = guest.localRatings[r.id] ?? {};
                              guest.setGuestRating(
                                r.id,
                                v == null ? null : { ...prev, rating: v, title: r.title }
                              );
                            }
                          }}
                        />
                      }
                    />
                    <div style={{ display: 'flex', gap: 8, margin: '0 0 8px 44px' }}>
                      <input
                        type="text"
                        value={drafts[r.id] ?? r.review ?? ''}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                        }
                        placeholder={str.yourReview}
                        style={{
                          flex: 1,
                          background: t.surface,
                          border: `1px solid ${t.border}`,
                          borderRadius: 8,
                          padding: '8px 12px',
                          color: t.text,
                          fontSize: 13,
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={() => saveReview(r.id, r)}
                        style={{
                          background: t.accent,
                          color: '#151A24',
                          border: 'none',
                          borderRadius: 8,
                          padding: '0 16px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {savedTick === r.id ? str.reviewSaved : str.saveReview}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* INSIGHTS TAB */}
        {tab === 'insights' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                [`♥ ${favRows.length}`, str.favTab],
                [`🔖 ${watchRows.length}`, str.watchTab],
                [`✓ ${seenRows.length}`, str.totalSeen],
                [`🔍 ${recentSearches.length}`, str.totalSearches],
                insights.avg != null
                  ? [`★ ${insights.avg.toFixed(1)}`, str.avgRating]
                  : null,
              ]
                .filter(Boolean)
                .map(([big, small]) => (
                  <div
                    key={small}
                    style={{
                      flex: '1 1 120px',
                      background: t.surface,
                      border: `1px solid ${t.border}`,
                      borderRadius: 12,
                      padding: '14px 16px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{big}</div>
                    <div style={{ fontSize: 12, color: t.muted }}>{small}</div>
                  </div>
                ))}
            </div>

            {insights.top.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, color: t.muted, margin: '0 0 10px' }}>
                  {str.topGenres}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {insights.top.map(([gid, w]) => (
                    <div key={gid} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 110, fontSize: 13, textAlign: 'right' }}>
                        {GENRE_MAP[gid] ?? gid}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 10,
                          borderRadius: 999,
                          background: t.border,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.round((w / insights.max) * 100)}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: `linear-gradient(90deg, ${t.accent}, ${t.accent}88)`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentSearches.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, color: t.muted, margin: '0 0 10px' }}>
                  {str.recent} · {recentSearches.length}
                </h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {recentSearches.slice(0, 12).map((s) => (
                    <span
                      key={s}
                      style={{
                        background: t.surface,
                        border: `1px solid ${t.border}`,
                        borderRadius: 999,
                        padding: '4px 12px',
                        fontSize: 12.5,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
