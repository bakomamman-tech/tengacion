import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

const normalizeMediaField = (value) => {
  if (!value) {
    return { url: "", public_id: "" };
  }
  if (typeof value === "string") {
    return { url: value, public_id: "" };
  }
  return {
    url: String(value.url || ""),
    public_id: String(value.public_id || ""),
  };
};

const normalizeUserMedia = (rawUser) => {
  if (!rawUser || typeof rawUser !== "object") {
    return rawUser;
  }
  return {
    ...rawUser,
    avatar: normalizeMediaField(rawUser.avatar),
    cover: normalizeMediaField(rawUser.cover),
  };
};

const persistUserSnapshot = (nextUser) => {
  try {
    if (!nextUser) {
      localStorage.removeItem("user");
      return;
    }
    localStorage.setItem("user", JSON.stringify(nextUser));
  } catch {
    // ignore storage errors
  }
};

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
        if (!alive) {return;}
        const normalized = normalizeUserMedia(res.data?.user || res.data || null);
        setUser(normalized);
        persistUserSnapshot(normalized);
      })
      .catch(() => {
        if (!alive) {return;}
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => {
        if (alive) {setLoading(false);}
      });

    // 🔒 HARD FAILSAFE (prevents infinite loading)
    const timeout = setTimeout(() => {
      if (alive) {setLoading(false);}
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
    if (!token || !userData) {return;}
    localStorage.setItem("token", token);
    const normalized = normalizeUserMedia(userData);
    setUser(normalized);
    persistUserSnapshot(normalized);
    setError(null);
  };

  const hardLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setLoading(false);
  };

  const updateUser = (data) => {
    setUser((u) => {
      const next = u ? normalizeUserMedia({ ...u, ...data }) : u;
      persistUserSnapshot(next);
      return next;
    });
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
