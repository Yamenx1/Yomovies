import { useState } from 'react';
import { Shuffle } from 'lucide-react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

// Example searches — tap to fill the box and run it. They teach by doing:
// each one shows the kind of everyday language the AI understands.
const EXAMPLES = [
  'I need a good cry',
  'something cozy for tonight',
  'give me an adrenaline rush',
  'bend my mind',
];

/**
 * MoodPicker — Search-first hero section:
 * 1. Headline
 * 2. Free-text input: Gemini names real films for ANY feeling (via the
 *    aiRecommend Convex action — keys stay server-side), TMDB verifies
 *    each title before it reaches the screen
 * 3. Example searches + "Surprise me" for zero-effort discovery
 *
 * Results flow up through onResults({ movies, reason }); failures through
 * onSearchError(message); spinner state through onSearchLoading(bool).
 */
export default function MoodPicker({
  t,
  onResults,
  onSearchLoading,
  onSearchError,
  onSurprise,
  apiReady,
}) {
  const [freeText, setFreeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const recommend = useAction(api.aiRecommend.recommend);

  async function runSearch(text) {
    const query = text.trim();
    if (!query || busy) return;
    setError(null);
    setBusy(true);
    onSearchLoading(true);
    try {
      const result = await recommend({ text: query });
      onResults({ movies: result.movies ?? [], reason: result.reason ?? null });
    } catch (err) {
      const message =
        err?.data?.message ?? err?.message ?? 'Search hiccup — try again.';
      setError(message);
      onSearchError(message);
    } finally {
      setBusy(false);
    }
  }

  function handleTextSubmit(e) {
    e.preventDefault();
    runSearch(freeText);
  }

  function runExample(example) {
    setFreeText(example);
    runSearch(example);
  }

  function surpriseMe() {
    setError(null);
    setFreeText('');
    if (onSurprise) onSurprise();
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px 0', textAlign: 'center' }}>
      <h1
        style={{
          fontFamily: "'Bebas Neue', 'Inter', sans-serif",
          fontWeight: 400,
          fontSize: 'clamp(46px, 9vw, 84px)',
          letterSpacing: 2,
          lineHeight: 1,
          margin: '0 0 14px',
        }}
      >
        What do you feel like watching tonight?
      </h1>
      <p style={{ color: t.muted, fontSize: 16, margin: '0 0 32px', lineHeight: 1.5 }}>
        Describe it in your own words — the AI picks real films for exactly that feeling.
      </p>

      {/* API key warning */}
      {!apiReady && (
        <div
          style={{
            background: `${t.accent}15`,
            border: `1px solid ${t.accent}40`,
            borderRadius: 10,
            padding: '16px 20px',
            marginBottom: 24,
            fontSize: 14,
            lineHeight: 1.6,
            color: t.text,
          }}
        >
          <strong>⚡ Almost there!</strong> Add your free TMDB API key to get real movies.
          <br />
          <span style={{ color: t.muted }}>
            Open <code style={{ background: t.surface, padding: '2px 6px', borderRadius: 4 }}>.env</code> and replace{' '}
            <code style={{ background: t.surface, padding: '2px 6px', borderRadius: 4 }}>YOUR_API_KEY_HERE</code> with your
            key from{' '}
            <a
              href="https://www.themoviedb.org/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: t.accent }}
            >
              themoviedb.org/settings/api
            </a>
          </span>
        </div>
      )}

      {/* Free-text input */}
      <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder={'e.g. "stressed about work" or "want to cry"'}
          style={{
            flex: 1,
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            padding: '13px 16px',
            color: t.text,
            fontSize: 15,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            background: t.accent,
            color: '#151A24',
            border: 'none',
            borderRadius: 8,
            padding: '0 20px',
            fontWeight: 600,
            fontSize: 15,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Reading…' : 'Find movies'}
        </button>
      </form>

      {error && (
        <p style={{ color: t.accent, fontSize: 13.5, marginTop: 0, marginBottom: 16 }}>
          {error}
        </p>
      )}

      {/* Example searches */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            className="mood-btn"
            onClick={() => runExample(ex)}
            style={{
              background: 'transparent',
              border: `1px solid ${t.border}`,
              color: t.muted,
              borderRadius: 999,
              padding: '8px 16px',
              fontSize: 13.5,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            “{ex}”
          </button>
        ))}
      </div>

      {/* Surprise me */}
      <button
        onClick={surpriseMe}
        style={{
          background: 'none',
          border: 'none',
          color: t.muted,
          fontSize: 13.5,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 12,
          fontFamily: 'inherit',
        }}
      >
        <Shuffle size={13} /> Surprise me
      </button>
    </div>
  );
}
