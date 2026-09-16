import { useState, useEffect, useRef } from 'react';
import { Shuffle, Share2, Check, History } from 'lucide-react';
import { useAction, useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';

const LOCAL_RECENT_KEY = 'yo-recent-searches';
const MAX_LOCAL_RECENT = 8;

function readLocalRecent() {
  try {
    const raw = localStorage.getItem(LOCAL_RECENT_KEY);
    const list = JSON.parse(raw ?? '[]');
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string').slice(0, MAX_LOCAL_RECENT) : [];
  } catch {
    return [];
  }
}

function writeLocalRecent(text) {
  const next = [text, ...readLocalRecent().filter((s) => s.toLowerCase() !== text.toLowerCase())].slice(
    0,
    MAX_LOCAL_RECENT
  );
  try {
    localStorage.setItem(LOCAL_RECENT_KEY, JSON.stringify(next));
  } catch {}
}

// Example searches — tap to fill the box and run it. They teach by doing:
// each one shows the kind of everyday language the AI understands.

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
  str,
  lang,
  onResults,
  onSearchLoading,
  onSearchError,
  onSurprise,
  apiReady,
}) {
  const [freeText, setFreeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [lastQuery, setLastQuery] = useState(null);
  const [localRecent, setLocalRecent] = useState(() => readLocalRecent());
  const recommend = useAction(api.aiRecommend.recommend);
  const { isAuthenticated } = useConvexAuth();
  const serverRecent = useQuery(api.recent.list);
  const logRecent = useMutation(api.recent.log);

  // Signed-in recents come from Convex, guests from localStorage
  const recent =
    isAuthenticated && serverRecent ? serverRecent : !isAuthenticated ? localRecent : [];

  function rememberSearch(query) {
    if (isAuthenticated) {
      logRecent({ text: query }).catch(() => {});
    } else {
      writeLocalRecent(query);
      setLocalRecent(readLocalRecent());
    }
  }

  // Deep link: ?q=<search> runs once on load so shared links replay
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current) return;
    deepLinked.current = true;
    const q = new URLSearchParams(window.location.search).get('q');
    if (q && q.trim()) {
      setFreeText(q.trim());
      runSearch(q.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL shareable: every search rewrites ?q= without reloading
  function syncUrl(query) {
    const url = new URL(window.location.href);
    url.searchParams.set('q', query);
    window.history.replaceState(null, '', url);
  }

  async function shareResults() {
    if (!lastQuery) return;
    const url = new URL(window.location.href);
    url.searchParams.set('q', lastQuery);
    const link = url.toString();
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard blocked — fall back to prompt-less selection trick
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function runSearch(text) {
    const query = text.trim();
    if (!query || busy) return;
    setError(null);
    setBusy(true);
    onSearchLoading(true);
    try {
      const result = await recommend({ text: query, lang });
      setLastQuery(query);
      syncUrl(query);
      rememberSearch(query);
      onResults({ movies: result.movies ?? [], reason: result.reason ?? null });
    } catch (err) {
      const message = err?.data?.message ?? err?.message ?? str.searchHiccup;
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
        {str.heroTitle}
      </h1>
      <p style={{ color: t.muted, fontSize: 16, margin: '0 0 32px', lineHeight: 1.5 }}>
        {str.heroSub}
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
          <strong>{str.apiWarnTitle}</strong> {str.apiWarnBody}
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
          placeholder={str.searchPlaceholder}
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
          {busy ? str.reading : str.find}
        </button>
      </form>

      {error && (
        <p style={{ color: t.accent, fontSize: 13.5, marginTop: 0, marginBottom: 16 }}>
          {error}
        </p>
      )}

      {/* Example searches */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
        {str.examples.map((ex) => (
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

      {/* Recent searches */}
      {recent.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span
            style={{
              color: t.muted,
              fontSize: 12.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <History size={12} /> {str.recent}
          </span>
          {recent.map((r) => (
            <button
              key={r}
              onClick={() => {
                setFreeText(r);
                runSearch(r);
              }}
              title={`Search again: ${r}`}
              style={{
                background: `${t.accent}12`,
                border: `1px solid ${t.border}`,
                color: t.text,
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 12.5,
                cursor: 'pointer',
                fontFamily: 'inherit',
                maxWidth: 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Surprise me + Share */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          marginTop: 12,
        }}
      >
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
            fontFamily: 'inherit',
          }}
        >
          <Shuffle size={13} /> {str.surprise}
        </button>
        {lastQuery && (
          <button
            onClick={shareResults}
            style={{
              background: 'none',
              border: 'none',
              color: copied ? t.accent : t.muted,
              fontSize: 13.5,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'inherit',
            }}
          >
            {copied ? <Check size={13} /> : <Share2 size={13} />}
            {copied ? str.copied : str.share}
          </button>
        )}
      </div>
    </div>
  );
}
