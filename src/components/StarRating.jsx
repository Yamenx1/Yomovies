import { useState } from 'react';
import { Star } from 'lucide-react';

/**
 * StarRating — 5-star picker with hover preview. Click the current value
 * again to clear. Calls onRate(1–5 | null).
 */
export default function StarRating({ value, onRate, t, size = 22 }) {
  const [hover, setHover] = useState(null);
  const shown = hover ?? value ?? 0;

  return (
    <div
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      onMouseLeave={() => setHover(null)}
      role="radiogroup"
      aria-label="Your rating"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onRate(value === n ? null : n)}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
          }}
        >
          <Star
            size={size}
            fill={n <= shown ? t.accent : 'none'}
            stroke={n <= shown ? t.accent : t.muted}
          />
        </button>
      ))}
    </div>
  );
}
