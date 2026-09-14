// ---------------------------------------------------------------------------
// AUTH CONTEXT — Provides authentication state to the entire app
// ---------------------------------------------------------------------------
// HOW REACT CONTEXT WORKS:
// Context lets you share data (like the logged-in user) with ANY component
// in your app without passing it through every level of props.
//
// 1. AuthProvider wraps your app and holds the auth state
// 2. useAuth() hook lets any component read the auth state
// 3. When the user logs in/out, ALL components using useAuth() re-render
//
// WHAT SUPABASE AUTH DOES FOR US:
// - Stores session tokens in localStorage (persists across refreshes)
// - Automatically refreshes expired tokens
// - Fires events when auth state changes (login, logout, token refresh)
// ---------------------------------------------------------------------------

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

// Create the context (starts as null — no user logged in)
const AuthContext = createContext(null);

/**
 * AuthProvider — Wrap your app with this to provide auth state everywhere.
 *
 * It listens to Supabase auth events and keeps the `user` state in sync.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while checking initial session

  useEffect(() => {
    // 1. Check if there's already a session (e.g., user refreshed the page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    // 3. Cleanup listener when component unmounts
    return () => subscription.unsubscribe();
  }, []);

  // --- Auth functions ---

  /**
   * Sign up with email and password.
   * Supabase will send a confirmation email by default.
   */
  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  }

  /**
   * Sign in with email and password.
   */
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }

  /**
   * Sign in with Google (opens a popup/redirect to Google's login page).
   * Requires Google provider to be enabled in Supabase Dashboard.
   */
  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin, // Come back to your app after login
      },
    });
    return { data, error };
  }

  /**
   * Sign out the current user.
   */
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  }

  // The value object that all components can access via useAuth()
  const value = {
    user,           // The current user object (null if not logged in)
    loading,        // True while checking initial session
    signUp,         // Function to create a new account
    signIn,         // Function to log in
    signInWithGoogle, // Function to log in with Google
    signOut,        // Function to log out
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth — Custom hook to access auth state from any component.
 *
 * Usage:
 *   const { user, signIn, signOut } = useAuth();
 *   if (user) console.log('Logged in as', user.email);
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
