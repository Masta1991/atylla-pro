import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { saveAuthSession, restoreAuthSession, clearStoredSession, noteUserActivity,
  setSessionExpiredCallback, SESSION_STORAGE_KEY } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const epoch = useRef(0);
  const activityTimer = useRef(null);
  const lastSent = useRef(0);

  const sendActivity = useCallback(() => {
    clearTimeout(activityTimer.current);
    lastSent.current = Date.now();
    return noteUserActivity().catch(() => false);
  }, []);

  const recordActivity = useCallback(event => {
    if (event?.isTrusted === false || (typeof document !== 'undefined' && document.hidden)) return;
    clearTimeout(activityTimer.current);
    if (Date.now() - lastSent.current >= 30000) sendActivity();
    else activityTimer.current = setTimeout(sendActivity, 500);
  }, [sendActivity]);

  useEffect(() => {
    let mounted = true;
    setSessionExpiredCallback(() => {
      epoch.current += 1;
      if (mounted) { setToken(null); setEmail(null); }
    });
    async function restore(foreground = false) {
      const attempt = epoch.current;
      try {
        const saved = await restoreAuthSession();
        if (!mounted || attempt !== epoch.current) return;
        setToken(saved?.access_token || null);
        setEmail(saved?.email || null);
        if (saved && foreground) await sendActivity();
      } catch {
        // Storage/network failure is not evidence of an expired session.
      } finally { if (mounted) setLoading(false); }
    }
    restore(true);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') restore(true);
      else clearTimeout(activityTimer.current);
    });
    const visibility = () => {
      if (!document.hidden) restore(true);
      else clearTimeout(activityTimer.current);
    };
    const storage = event => {
      if (event.key === null || event.key === SESSION_STORAGE_KEY) restore(false);
    };
    const inputs = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', visibility);
      inputs.forEach(name => document.addEventListener(name, recordActivity, { passive: true }));
    }
    if (typeof window !== 'undefined') window.addEventListener('storage', storage);
    return () => {
      mounted = false;
      subscription.remove();
      clearTimeout(activityTimer.current);
      setSessionExpiredCallback(null);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibility);
        inputs.forEach(name => document.removeEventListener(name, recordActivity));
      }
      if (typeof window !== 'undefined') window.removeEventListener('storage', storage);
    };
  }, [recordActivity, sendActivity]);

  async function signIn(data, userEmail) {
    const attempt = ++epoch.current;
    await saveAuthSession(data, userEmail);
    if (attempt === epoch.current) { setToken(data.access_token); setEmail(userEmail); }
  }

  async function signOut() {
    epoch.current += 1;
    clearTimeout(activityTimer.current);
    setToken(null); setEmail(null);
    await clearStoredSession();
  }

  return (
    <AuthContext.Provider value={{ token, email, loading, signIn, signOut, recordActivity }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
