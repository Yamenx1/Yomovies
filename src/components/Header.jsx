import { Sun, Moon, Heart, User } from 'lucide-react';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { useNavigate } from 'react-router-dom';

/**
 * Header — Logo + site name + Clerk auth controls + dark/light mode toggle.
 *
 * When signed out: shows "Sign In" and "Sign Up" buttons (Clerk modals)
 * When signed in: shows Clerk UserButton
 */
export default function Header({ theme, t, str, lang, onToggleLang, onToggleTheme, onHome, onOpenFavorites, favCount }) {
  const navigate = useNavigate();
  return (
    <>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          rowGap: 12,
          maxWidth: 960,
          margin: '0 auto',
          padding: '24px 20px 0',
        }}
      >
        {/* Logo — click to go back to the main menu */}
        <div
          onClick={onHome}
          title={str.homeTitle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: onHome ? 'pointer' : 'default',
          }}
        >
          <img
            src={t.logo}
            alt="Yo Movies logo"
            style={{ height: 44, width: 'auto', display: 'block' }}
          />
          <span
            style={{
              fontFamily: "'Bebas Neue', 'Inter', sans-serif",
              fontWeight: 400,
              fontSize: 24,
              letterSpacing: 2,
            }}
          >
            Yo Movies
          </span>
        </div>

        {/* Right side: Auth + Theme toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Show when="signed-out">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SignInButton mode="modal">
                <button
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
                  {str.signIn}
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  style={{
                    background: 'none',
                    border: `1px solid ${t.border}`,
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: t.text,
                    fontFamily: 'inherit',
                  }}
                >
                  {str.signUp}
                </button>
              </SignUpButton>
            </div>
          </Show>
          <Show when="signed-in">
            <UserButton afterSignOutUrl="/" />
          </Show>

          {/* Profile */}
          <button
            onClick={() => navigate('/profile')}
            title={str.profileTitle}
            aria-label={str.profileTitle}
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
            <User size={16} />
          </button>

          {/* Favorites */}
          <button
            onClick={onOpenFavorites}
            title={str.favTitle}
            aria-label={str.favTitle}
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
              color: favCount > 0 ? t.accent : t.text,
              position: 'relative',
            }}
          >
            <Heart size={16} fill={favCount > 0 ? t.accent : 'none'} />
            {favCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  background: t.accent,
                  color: '#151A24',
                  fontSize: 10.5,
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {favCount > 99 ? '99+' : favCount}
              </span>
            )}
          </button>

          {/* Language toggle */}
          <button
            onClick={onToggleLang}
            title={lang === 'ar' ? 'English' : 'عربي'}
            aria-label="Switch language"
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 999,
              minWidth: 38,
              height: 38,
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: t.text,
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            {str.langName}
          </button>

          {/* Theme toggle */}
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={str.themeToggleLabel}
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
    </>
  );
}
