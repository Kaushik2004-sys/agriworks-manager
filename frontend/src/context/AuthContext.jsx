// Phase 2: Auth state shared across the app.
// Stores token in localStorage so login survives page refresh.
import { createContext, useContext, useEffect, useState } from 'react';
import { changePassword as apiChangePassword, getCurrentUser, getProfile, loginUser, logoutUser, registerUser, updateProfile as apiUpdateProfile } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('agriworks_token'));
  const [loading, setLoading] = useState(true);

  // On app start: if token exists, verify it with GET /api/me/
  useEffect(() => {
    async function verify() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await getCurrentUser();
        setUser(me);
      } catch {
        // Invalid/expired token -> clear it
        localStorage.removeItem('agriworks_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, [token]);

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

  async function logout() {
    try {
      await logoutUser();
    } catch {
      // Even if backend fails, clear local state
    } finally {
      localStorage.removeItem('agriworks_token');
      setToken(null);
      setUser(null);
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
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, updateProfile, changePassword, loadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
