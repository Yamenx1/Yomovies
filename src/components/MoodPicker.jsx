import { useState } from 'react';
import { Shuffle, Sparkles } from 'lucide-react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { matchMoodFromText } from '../config/moods';

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
 * 2. Free-text input read by Gemini (via a Convex action, key stays
 *    server-side), with keyword matching as the offline fallback
 * 3. Example searches + "Surprise me" for zero-effort discovery
 *
 * Also shows an API key warning if TMDB isn't configured yet.
 */
export default function MoodPicker({ t, onMoodSelect, onSurprise, apiReady }) {
  const [freeText, setFreeText] = useState('');
  const [noMatch, setNoMatch] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState(null);
  const detectMood = useAction(api.moodAi.detectMood);

  async function runSearch(text) {
    const query = text.trim();
    if (!query || aiLoading) return;
    setNoMatch(false);
    setAiNote(null);

    // 1. Ask Gemini first (server-side action — API key never hits the browser)
    setAiLoading(true);
    try {
      const ai = await detectMood({ text: query });
      if (ai?.moodId) {
        onMoodSelect(ai.moodId);
        setAiNote(
          `✨ ${ai.reason ?? 'Picked for you'}` +
            (typeof ai.confidence === 'number' ? ` (${ai.confidence}%)` : '')
        );
        return;
      }
    } catch {
      // AI unreachable — fall through to keywords below
    } finally {
      setAiLoading(false);
    }

    // 2. Keyword fallback (also covers AI downtime)
    const matched = matchMoodFromText(query);
    if (matched) {
      onMoodSelect(matched);
    } else {
      setNoMatch(true);
      onMoodSelect(null);
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
    setNoMatch(false);
    setAiNote(null);
    setFreeText('');
    // True random movies (handled by the parent) — not a random mood
    if (onSurprise) onSurprise();
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px 0', textAlign: 'center' }}>
      <h1
        style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 600,
          fontSize: 'clamp(28px, 5vw, 42px)',
          lineHeight: 1.15,
          margin: '0 0 14px',
        }}
      >
        What do you feel like watching tonight?
      </h1>
      <p style={{ color: t.muted, fontSize: 16, margin: '0 0 32px', lineHeight: 1.5 }}>
        Describe it in your own words — the AI reads the feeling, no genres required.
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
          disabled={aiLoading}
          style={{
            background: t.accent,
            color: '#151A24',
            border: 'none',
            borderRadius: 8,
            padding: '0 20px',
            fontWeight: 600,
            fontSize: 15,
            cursor: aiLoading ? 'wait' : 'pointer',
            opacity: aiLoading ? 0.7 : 1,
          }}
        >
          {aiLoading ? 'Reading…' : 'Find movies'}
        </button>
      </form>

      {aiNote && (
        <p
          style={{
            color: t.accent,
            fontSize: 13.5,
            marginTop: 0,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Sparkles size={13} /> {aiNote}
        </p>
      )}

      {noMatch && (
        <p style={{ color: t.muted, fontSize: 14, marginTop: 0, marginBottom: 16 }}>
          Couldn't quite place that feeling — try different words, or hit Surprise me:
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
