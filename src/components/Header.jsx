import { useState } from 'react';
import { Sun, Moon, LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AuthModal from './AuthModal';

/**
 * Header — Logo + site name + auth button + dark/light mode toggle.
 *
 * When logged out: shows "Sign In" button
 * When logged in: shows user avatar/email + "Sign Out" button
 */
export default function Header({ theme, t, onToggleTheme }) {
  const { user, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  // Get display name: use email username or Google display name
  const displayName = user
    ? user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
    : null;

  // Get avatar: Google provides one, otherwise use first letter
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <>
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
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src={t.logo}
            alt="Yo Movies logo"
            style={{ height: 44, width: 'auto', display: 'block' }}
          />
          <span
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
              fontSize: 17,
              letterSpacing: 0.2,
            }}
          >
            Yo Movies
          </span>
        </div>

        {/* Right side: Auth + Theme toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user ? (
            // Logged in — show avatar + name + sign out
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: `2px solid ${t.accent}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: t.accent,
                    color: '#151A24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                style={{
                  fontSize: 13.5,
                  color: t.muted,
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </span>
              <button
                onClick={() => signOut()}
                title="Sign out"
                style={{
                  background: 'none',
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  color: t.muted,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12.5,
                  fontFamily: 'inherit',
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            // Not logged in — show sign in button
            <button
              onClick={() => setShowAuth(true)}
              style={{
                background: t.accent,
                color: '#151A24',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'inherit',
              }}
            >
              <LogIn size={14} />
              Sign In
            </button>
          )}

          {/* Theme toggle */}
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label="Toggle light and dark mode"
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 999,
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: t.text,
            }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Auth Modal */}
      {showAuth && <AuthModal t={t} onClose={() => setShowAuth(false)} />}
    </>
  );
}
