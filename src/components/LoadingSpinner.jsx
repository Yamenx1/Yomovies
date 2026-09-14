/**
 * LoadingSpinner — Shows while movies are being fetched from TMDB.
 *
 * It's a simple CSS-animated spinner — no external libraries needed.
 * The animation uses the theme's accent color (coral).
 */
export default function LoadingSpinner({ t }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: `3px solid ${t.border}`,
          borderTopColor: t.accent,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p style={{ color: t.muted, fontSize: 14 }}>Finding movies for you…</p>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
