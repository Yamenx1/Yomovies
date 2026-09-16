import { useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { getImageUrl } from '../services/tmdb';

/**
 * FavoritesDrawer — Glass slide-over panel from the right edge:
 * poster thumb, title, year · tap a row to view details, trash to remove.
 */
export default function FavoritesDrawer({ t, str, items, persistent, onClose, onView, onRemove }) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 90,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(360px, 92vw)',
          background: `${t.surface}E0`,
          backdropFilter: 'blur(24px) saturate(150%)',
          WebkitBackdropFilter: 'blur(24px) saturate(150%)',
          borderLeft: `1px solid ${t.border}`,
          boxShadow: '-24px 0 60px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.25s ease',
        }}
      >
        <style>{`
          @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: none; opacity: 1; } }
        `}</style>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 20px 14px',
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <h2
            style={{
              fontFamily: "'Bebas Neue', 'Inter', sans-serif",
              fontWeight: 400,
              fontSize: 26,
              letterSpacing: 1.5,
              margin: 0,
            }}
          >
            {str.favTitle} ({items.length})
          </h2>
          <button
            onClick={onClose}
            aria-label={str.closeFavorites}
            style={{
              background: 'none',
              border: `1px solid ${t.border}`,
              borderRadius: 999,
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: t.muted,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {items.length === 0 && (
            <p style={{ color: t.muted, fontSize: 14, textAlign: 'center', marginTop: 40 }}>
              {str.favEmpty}
            </p>
          )}
          {items.map((m) => {
            const poster = getImageUrl(m.poster_path, 'w92');
            const year = m.release_date ? new Date(m.release_date).getFullYear() : null;
            return (
              <div
                key={m.id}
                onClick={() => onView(m)}
                title={str.viewDetailsFor(m.title)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 8,
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${t.accent}14`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {poster ? (
                  <img
                    src={poster}
                    alt=""
                    loading="lazy"
                    style={{ width: 44, borderRadius: 6, flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 66,
                      borderRadius: 6,
                      background: t.border,
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {m.title}
                  </div>
                  <div style={{ color: t.muted, fontSize: 12 }}>
                    {year ?? '—'}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(m);
                  }}
                  aria-label={str.removeFavorite(m.title)}
                  title={str.removeFavorite(m.title)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: t.muted,
                    cursor: 'pointer',
                    padding: 6,
                    borderRadius: 8,
                    display: 'flex',
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: `1px solid ${t.border}`,
            color: t.muted,
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          {persistent ? str.favSyncIn : str.favSyncOut}
        </div>
      </aside>
    </div>
  );
}
