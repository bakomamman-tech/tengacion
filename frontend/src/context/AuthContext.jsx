import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

/* ======================================================
   FACEBOOK-GRADE AUTH PROVIDER (FAILSAFE)
====================================================== */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ===== AXIOS INTERCEPTORS ===== */
  useEffect(() => {
    const req = axios.interceptors.request.use((config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    const res = axios.interceptors.response.use(
      (r) => r,
      (err) => {
        if (err?.response?.status === 401) {
          hardLogout();
        }
        return Promise.reject(err);
      }
    );

    return () => {
      axios.interceptors.request.eject(req);
      axios.interceptors.response.eject(res);
    };
  }, []);

  /* ===== RESTORE SESSION (NON-BLOCKING) ===== */
  useEffect(() => {
    let alive = true;

    const token = localStorage.getItem("token");

    // Guest: never block UI
    if (!token) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    axios
      .get("/api/auth/me", { signal: controller.signal })
      .then((res) => {
        if (!alive) return;
        setUser(res.data || null);
      })
      .catch(() => {
        if (!alive) return;
        localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    // 🔒 HARD FAILSAFE (prevents infinite loading)
    const timeout = setTimeout(() => {
      if (alive) setLoading(false);
    }, 4000);

    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  /* ===== MULTI-TAB SYNC ===== */
  useEffect(() => {
    const sync = (e) => {
      if (e.key === "token" && !e.newValue) {
        setUser(null);
      }
    };

    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  /* ===== ACTIONS ===== */

  const login = (token, userData) => {
    if (!token || !userData) return;
    localStorage.setItem("token", token);
    setUser(userData);
    setError(null);
  };

  const hardLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setLoading(false);
  };

  const updateUser = (data) => {
    setUser((u) => (u ? { ...u, ...data } : u));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,

        login,
        logout: hardLogout,
        updateUser,

        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
