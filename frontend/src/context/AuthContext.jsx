import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

export const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

/* ======================================================
   FACEBOOK-LEVEL AUTH PROVIDER
====================================================== */

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ===== AXIOS GLOBAL INTERCEPTOR ===== */
  useEffect(() => {
    const req = axios.interceptors.request.use((config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = "Bearer " + token;
      }
      return config;
    });

    const res = axios.interceptors.response.use(
      (response) => response,
      (err) => {
        // Auto logout on 401 – Facebook style
        if (err.response?.status === 401) {
          logout();
          window.dispatchEvent(new Event("session-expired"));
        }
        return Promise.reject(err);
      }
    );

    return () => {
      axios.interceptors.request.eject(req);
      axios.interceptors.response.eject(res);
    };
  }, []);

  /* ===== RESTORE SESSION ON START ===== */
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    axios
      .get("/api/auth/me")
      .then((res) => {
        setUser(res.data);
        window.__USER__ = res.data; // debug helper
      })
      .catch(() => {
        localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  /* ===== MULTI TAB SYNC ===== */
  useEffect(() => {
    const sync = (e) => {
      if (e.key === "token" && !e.newValue) {
        setUser(null);
      }
    };

    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  /* ===== AUTH ACTIONS ===== */

  const login = (token, userData) => {
    if (!token || !userData) return;

    localStorage.setItem("token", token);
    setUser(userData);
    setError(null);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const updateUser = (data) => {
    setUser((u) => ({ ...u, ...data }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,

        login,
        logout,
        updateUser,

        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
