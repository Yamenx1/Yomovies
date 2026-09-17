import { ClerkProvider, useAuth } from '@clerk/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

function bootstrap() {
  const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!PUBLISHABLE_KEY) {
    throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY — run `clerk env pull` to sync Clerk keys');
  }

  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;

  if (!CONVEX_URL) {
    throw new Error('Missing VITE_CONVEX_URL — run `npx convex dev` to sync Convex URL');
  }

  const convex = new ConvexReactClient(CONVEX_URL);

  // BrowserRouter enables shareable URLs (/movie/:id, /profile) with
  // working back-button support (see vercel.json SPA rewrite).
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
              <App />
            </ConvexProviderWithClerk>
          </ClerkProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
}

try {
  bootstrap();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('YoMovies failed to start:', error);
  const safe = String(error?.message ?? error)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;');
  document.getElementById('root').innerHTML =
    `<div style="min-height:100vh;background:#151A24;color:#f5f0e8;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px">` +
    `<div style="max-width:560px"><h1 style="font-size:20px">😕 YoMovies failed to start</h1>` +
    `<pre style="background:#00000055;border:1px solid #ffffff22;border-radius:8px;padding:12px;font-size:13px;white-space:pre-wrap;word-break:break-word">${safe}</pre>` +
    `<p style="font-size:13px;opacity:.7">Screenshot this and send it over — it says exactly what's missing.</p></div></div>`;
}

// PWA: offline app-shell cache, production only (dev keeps hot reload clean)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}