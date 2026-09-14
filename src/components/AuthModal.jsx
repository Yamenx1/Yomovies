// ---------------------------------------------------------------------------
// AUTH MODAL — Beautiful login/signup popup
// ---------------------------------------------------------------------------
// Shows a modal overlay with:
// - Email + Password form (toggles between Sign In and Sign Up)
// - Google sign-in button
// - Error messages
// - Loading states
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function AuthModal({ t, onClose }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: err } = await signUp(email, password);
        if (err) throw err;
        setSuccessMsg('Check your email for a confirmation link!');
        setEmail('');
        setPassword('');
      } else {
        const { error: err } = await signIn(email, password);
        if (err) throw err;
        onClose(); // Close modal on successful sign in
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    const { error: err } = await signInWithGoogle();
    if (err) setError(err.message);
    // Google login redirects, so no need to close modal
  }

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 16,
          padding: '36px 32px',
          width: '100%',
          maxWidth: 400,
          animation: 'rise 0.25s ease',
        }}
      >
        {/* Title */}
        <h2
          style={{
            fontFamily: "'Fraunces', serif",
            fontWeight: 600,
            fontSize: 24,
            textAlign: 'center',
            marginBottom: 6,
            color: t.text,
          }}
        >
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </h2>
        <p
          style={{
            textAlign: 'center',
            color: t.muted,
            fontSize: 14,
            marginBottom: 28,
          }}
        >
          {mode === 'signin'
            ? 'Sign in to save your preferences'
            : 'Join Yo Movies to save your watchlist'}
        </p>

        {/* Google Sign In */}
        <button
          onClick={handleGoogle}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: `1px solid ${t.border}`,
            background: t.bg,
            color: t.text,
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontFamily: 'inherit',
            marginBottom: 20,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={{ flex: 1, height: 1, background: t.border }} />
          <span style={{ color: t.muted, fontSize: 12 }}>or</span>
          <div style={{ flex: 1, height: 1, background: t.border }} />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: `1px solid ${t.border}`,
              background: t.bg,
              color: t.text,
              fontSize: 15,
              fontFamily: 'inherit',
              marginBottom: 10,
              outline: 'none',
            }}
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: `1px solid ${t.border}`,
              background: t.bg,
              color: t.text,
              fontSize: 15,
              fontFamily: 'inherit',
              marginBottom: 16,
              outline: 'none',
            }}
          />

          {/* Error message */}
          {error && (
            <p
              style={{
                color: '#ef4444',
                fontSize: 13,
                marginBottom: 12,
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              {error}
            </p>
          )}

          {/* Success message */}
          {successMsg && (
            <p
              style={{
                color: '#22c55e',
                fontSize: 13,
                marginBottom: 12,
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              ✓ {successMsg}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 10,
              border: 'none',
              background: t.accent,
              color: '#151A24',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontFamily: 'inherit',
              marginBottom: 16,
            }}
          >
            {loading
              ? 'Please wait…'
              : mode === 'signin'
              ? 'Sign In'
              : 'Create Account'}
          </button>
        </form>

        {/* Toggle between sign in / sign up */}
        <p
          style={{
            textAlign: 'center',
            color: t.muted,
            fontSize: 13.5,
          }}
        >
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setSuccessMsg(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: t.accent,
              cursor: 'pointer',
              fontSize: 13.5,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
