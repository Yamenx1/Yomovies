import { useState } from 'react';
import { Shuffle, Sparkles } from 'lucide-react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MOODS, matchMoodFromText } from '../config/moods';

/**
 * MoodPicker — The hero section with:
 * 1. Headline
 * 2. AI text input: Gemini (via a Convex action, key stays server-side)
 *    reads the feeling, then keyword matching backs it up offline
 * 3. Mood buttons grid
 * 4. "Surprise me" button
 *
 * Also shows an API key warning if TMDB isn't configured yet.
 */
export default function MoodPicker({ t, selectedMood, onMoodSelect, apiReady }) {
  const [freeText, setFreeText] = useState('');
  const [noMatch, setNoMatch] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState(null);
  const detectMood = useAction(api.moodAi.detectMood);

  async function handleTextSubmit(e) {
    e.preventDefault();
    const text = freeText.trim();
    if (!text || aiLoading) return;
    setNoMatch(false);
    setAiNote(null);

    // 1. Ask Gemini first (server-side action — API key never hits the browser)
    setAiLoading(true);
    try {
      const ai = await detectMood({ text });
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
    const matched = matchMoodFromText(text);
    if (matched) {
      onMoodSelect(matched);
    } else {
      setNoMatch(true);
      onMoodSelect(null);
    }
  }

  function pickMood(id) {
    setNoMatch(false);
    setAiNote(null);
    setFreeText('');
    onMoodSelect(id);
  }

  function surpriseMe() {
    const randomMood = MOODS[Math.floor(Math.random() * MOODS.length)];
    pickMood(randomMood.id);
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
        Tell me your mood, or pick one below — no plot summaries required.
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
      <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
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
            marginTop: -16,
            marginBottom: 20,
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
        <p style={{ color: t.muted, fontSize: 14, marginTop: -16, marginBottom: 20 }}>
          Couldn't quite place that mood — try one of these instead:
        </p>
      )}

      {/* Mood buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
        {MOODS.map((m) => (
          <button
            key={m.id}
            className="mood-btn"
            onClick={() => pickMood(m.id)}
            style={{
              background: 'transparent',
              border: `1px solid ${selectedMood === m.id ? t.accent : t.border}`,
              color: selectedMood === m.id ? t.text : t.muted,
              borderRadius: 999,
              padding: '8px 16px',
              fontSize: 13.5,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {m.label}
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
