import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { migrateAnonymousConversations } from "../hooks/useConversations";

const STORAGE_KEY = "mytartan_auth";
const API_BASE = process.env.REACT_APP_API_URL || "";

const AuthContext = createContext(null);

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, token: null };
    const parsed = JSON.parse(raw);
    return {
      user: parsed.user ?? null,
      token: parsed.token ?? null,
    };
  } catch {
    return { user: null, token: null };
  }
}

function writeStoredAuth(user, token) {
  if (!token) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
}

async function authRequest(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallback =
      response.status === 404
        ? "Auth API not found — restart the server (npm run dev) so /api/auth routes load."
        : `Request failed (${response.status})`;
    throw new Error(data.error || data.message || fallback);
  }
  return data;
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth);

  const persistAuth = useCallback((user, token) => {
    setAuth({ user, token });
    writeStoredAuth(user, token);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authRequest("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    migrateAnonymousConversations(data.user?.id);
    persistAuth(data.user, data.token);
    return data;
  }, [persistAuth]);

  const signup = useCallback(async (email, password) => {
    const data = await authRequest("/api/auth/signup", {
      method: "POST",
      body: { email, password },
    });
    persistAuth(data.user, data.token);
    return data;
  }, [persistAuth]);

  const requestPasswordReset = useCallback(async (email) => {
    return authRequest("/api/auth/forgot-password", {
      method: "POST",
      body: { email },
    });
  }, []);

  const resetPassword = useCallback(async (token, password) => {
    return authRequest("/api/auth/reset-password", {
      method: "POST",
      body: { token, password },
    });
  }, []);

  const verifyEmail = useCallback(async (token) => {
    const data = await authRequest("/api/auth/verify-email", {
      method: "POST",
      body: { token },
    });
    if (data.user && data.token) {
      persistAuth(data.user, data.token);
    }
    return data;
  }, [persistAuth]);

  const resendVerification = useCallback(async () => {
    if (!auth.token) throw new Error("Not authenticated");
    return authRequest("/api/auth/resend-verification", {
      method: "POST",
      token: auth.token,
    });
  }, [auth.token]);

  const fetchMailStatus = useCallback(async () => {
    return authRequest("/api/auth/mail-status");
  }, []);

  const logout = useCallback(async () => {
    try {
      if (auth.token) {
        await authRequest("/api/auth/logout", {
          method: "POST",
          token: auth.token,
        });
      }
    } catch {
      // Clear local session even if server logout fails
    }
    persistAuth(null, null);
  }, [auth.token, persistAuth]);

  const updateProfile = useCallback(async (profileFields) => {
    if (!auth.token) throw new Error("Not authenticated");
    const data = await authRequest("/api/auth/profile", {
      method: "PATCH",
      body: profileFields,
      token: auth.token,
    });
    const nextUser = data.user ?? {
      ...auth.user,
      profile: { ...auth.user?.profile, ...(data.profile ?? profileFields) },
    };
    persistAuth(nextUser, auth.token);
    return data;
  }, [auth.token, auth.user, persistAuth]);

  const value = useMemo(
    () => ({
      user: auth.user,
      token: auth.token,
      isAuthenticated: Boolean(auth.token),
      login,
      signup,
      logout,
      updateProfile,
      requestPasswordReset,
      resetPassword,
      verifyEmail,
      resendVerification,
      fetchMailStatus,
    }),
    [
      auth,
      login,
      signup,
      logout,
      updateProfile,
      requestPasswordReset,
      resetPassword,
      verifyEmail,
      resendVerification,
      fetchMailStatus,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
