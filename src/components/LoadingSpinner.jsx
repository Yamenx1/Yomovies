/**
 * LoadingSpinner — Skeleton movie cards while results load.
 * Matches the glass card shape so the layout doesn't jump when real
 * posters arrive. Falls back to a spinner-free pulse (reduced motion OK).
 */
export default function LoadingSpinner({ t }) {
  const bones = Array.from({ length: 8 });
  return (
    <div
      role="status"
      aria-label="Loading movies"
      style={{ maxWidth: 960, margin: '0 auto', padding: '0 0 20px' }}
    >
      <div className="movie-grid">
        {bones.map((_, i) => (
          <div
            key={i}
            style={{
              background: `${t.surface}80`,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              overflow: 'hidden',
              animationDelay: `${i * 60}ms`,
            }}
            className="skeleton-card"
          >
            <div
              className="skeleton-pulse"
              style={{
                width: '100%',
                aspectRatio: '2 / 3',
                background: `linear-gradient(100deg, ${t.border}55 30%, ${t.border}AA 50%, ${t.border}55 70%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s ease infinite',
              }}
            />
            <div style={{ padding: '16px' }}>
              <div
                className="skeleton-pulse"
                style={{
                  height: 18,
                  width: '70%',
                  borderRadius: 6,
                  marginBottom: 10,
                  background: `linear-gradient(100deg, ${t.border}55 30%, ${t.border}AA 50%, ${t.border}55 70%)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.4s ease infinite',
                }}
              />
              <div
                className="skeleton-pulse"
                style={{
                  height: 12,
                  width: '45%',
                  borderRadius: 6,
                  background: `linear-gradient(100deg, ${t.border}55 30%, ${t.border}AA 50%, ${t.border}55 70%)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.4s ease infinite',
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .skeleton-pulse { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
