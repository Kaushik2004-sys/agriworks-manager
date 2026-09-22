// Phase 2: Auth state shared across the app.
// Stores token in localStorage so login survives page refresh.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import api, { changePassword as apiChangePassword, getCurrentUser, getProfile, googleAuthUser, loginUser, registerUser, updateProfile as apiUpdateProfile } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('agriworks_token'));
  const [loading, setLoading] = useState(true);
  // null = verified/unknown, 'network' = backend unreachable (token is KEPT),
  // 'unauthorized' = token rejected by the server (token is cleared).
  const [authError, setAuthError] = useState(null);
  const verifyingRef = useRef(false);

  // Validate the stored token with GET /api/me/, like a fresh page load.
  // Only 401/403 clears the session; network/timeout errors keep the token
  // so a retry or refresh can still restore a valid session.
  async function verifySession(opts = {}) {
    if (verifyingRef.current) return;
    const stored = localStorage.getItem('agriworks_token');
    if (!stored) {
      setToken(null);
      setUser(null);
      setAuthError(null);
      setLoading(false);
      return;
    }
    verifyingRef.current = true;
    if (!opts.background) setLoading(true);
    try {
      const me = await getCurrentUser();
      setUser(me);
      setAuthError(null);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        // Invalid/expired token -> clear it and go to login.
        localStorage.removeItem('agriworks_token');
        setToken(null);
        setUser(null);
        setAuthError('unauthorized');
      } else {
        // Unreachable backend: keep the token, offer retry instead of login.
        setUser(null);
        setAuthError('network');
      }
    } finally {
      verifyingRef.current = false;
      setLoading(false);
    }
  }

  const verifyRef = useRef(null);
  // Keep the ref fresh outside of render so pageshow/online handlers
  // and effects always call the latest verifySession.
  useEffect(() => {
    verifyRef.current = verifySession;
  });

  // On app start / token change: validate the session like a fresh load.
  useEffect(() => {
    verifyRef.current();
  }, [token]);

  // Single-device session heartbeat: while a token is stored, re-check the
  // existing authenticated /me/ endpoint every 5s. If the same user logged
  // in from another browser/device, the backend has rotated the token, so
  // this browser's /me/ call gets 401 and is sent back to Login within one
  // interval — no refresh, click, or other API call required.
  // Only HTTP 401 invalidates the session. HTTP 403 (permissions), timeouts
  // and network failures must NOT log the user out.
  useEffect(() => {
    if (!token) return undefined;
    let stopped = false;
    let inFlight = false;
    async function beat() {
      if (stopped || inFlight) return;
      // P12: skip the heartbeat while the tab is hidden - the Pageshow /
      // online handlers revalidate on return, so no session change is
      // missed and no useless /me/ traffic is sent in the background.
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!localStorage.getItem('agriworks_token')) return;
      inFlight = true;
      try {
        const me = await getCurrentUser();
        if (stopped) return;
        setUser(me);
        setAuthError(null);
      } catch (err) {
        if (stopped) return;
        if (err?.response?.status === 401) {
          stopped = true;
          localStorage.removeItem('agriworks_token');
          setToken(null);
          setUser(null);
          setAuthError('unauthorized');
          if (!window.location.pathname.startsWith('/login')) {
            // replace (not href): same reason as the api.js 401 handler.
            window.location.replace('/login');
          }
        }
      } finally {
        inFlight = false;
      }
    }
    const id = window.setInterval(beat, 5000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [token]);

  // Browser History / back-forward restores: pageshow with persisted=true
  // means the page came from the back-forward cache with a frozen tree,
  // so never trust it. Without a stored token the state resets
  // synchronously (no stale frame); otherwise the session revalidates.
  // 'online' re-checks after the connection drops (common on mobile).
  // 'storage' catches logout in another tab. No navigation is intercepted.
  useEffect(() => {
    function resetSync() {
      setToken(null);
      setUser(null);
      setAuthError(null);
      setLoading(false);
    }
    function onPageShow(e) {
      if (!e.persisted) return;
      if (!localStorage.getItem('agriworks_token')) {
        resetSync();
      } else {
        // A bfcache restore paints the frozen previous-session document
        // (with its already-fetched lists) before React re-runs. Drop the
        // in-memory user first so guards render "Checking login..." instead
        // of stale records, then revalidate the CURRENT session in the
        // background. Same end state as a fresh load, no navigation here.
        setUser(null);
        setAuthError(null);
        setLoading(true);
        verifyRef.current({ background: true });
      }
    }
    function onOnline() {
      verifyRef.current({ background: true });
    }
    function onStorage(e) {
      if (e.key === 'agriworks_token' && !e.newValue) {
        resetSync();
      }
    }
    // Back/Forward inside the SPA re-checks the session against the server
    // without blocking the render: if the token died (expiry, rotation by a
    // new login elsewhere, server-side logout), the next 401 clears state
    // and the guards bounce to Login via replace. Never navigates itself,
    // so normal in-session Back/Forward keeps working and cannot loop.
    function onPopState() {
      if (localStorage.getItem('agriworks_token')) {
        verifyRef.current({ background: true });
      }
    }
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);
    window.addEventListener('storage', onStorage);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  async function login(identifier, password) {
    const data = await loginUser(identifier, password);
    localStorage.setItem('agriworks_token', data.token);
    setToken(data.token);
    // Full profile (incl. company) loads on next /me/ verify; keep it fast here.
    setUser({ username: data.username, email: data.email });
    return data;
  }

  async function register(form) {
    const data = await registerUser(form);
    localStorage.setItem('agriworks_token', data.token);
    setToken(data.token);
    setUser({ username: data.username, email: data.email, ...data.profile });
    return data;
  }

  // Google sign-in/sign-up: the backend verifies the GIS credential and
  // returns the normal session shape, so storage, heartbeat, guards and
  // logout all behave exactly like password login from here on.
  async function googleLogin(credential, mobile, extra) {
    const data = await googleAuthUser(credential, mobile, extra);
    localStorage.setItem('agriworks_token', data.token);
    setToken(data.token);
    setUser({ username: data.username, email: data.email });
    return data;
  }

  async function logout() {
    // Clear the local session FIRST so Back pressed mid-logout can never
    // restore a usable authenticated page; then invalidate the token
    // server-side with an explicit header (the interceptor finds no
    // stored token anymore). A failed invalidate only risks an orphan
    // token row, never a usable session in this browser.
    const stored = localStorage.getItem('agriworks_token');
    localStorage.removeItem('agriworks_token');
    sessionStorage.removeItem('aw_post_login');
    setToken(null);
    setUser(null);
    setAuthError(null);
    setLoading(false);
    if (stored) {
      try {
        await api.post('/logout/', {}, { headers: { Authorization: `Token ${stored}` } });
      } catch {
        // Local state is already clear; nothing left to do here.
      }
    }
  }

  async function refreshUser() {
    const me = await getCurrentUser();
    setUser(me);
    return me;
  }

  async function updateProfile(data) {
    await apiUpdateProfile(data);
    return refreshUser();
  }

  async function changePassword(data) {
    const res = await apiChangePassword(data);
    // Backend rotates the token on password change - keep the session alive.
    if (res.token) {
      localStorage.setItem('agriworks_token', res.token);
      setToken(res.token);
    }
    return res;
  }

  async function loadProfile() {
    return getProfile();
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, authError, revalidate: (opts) => verifySession(opts), login, register, googleLogin, logout, refreshUser, updateProfile, changePassword, loadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
