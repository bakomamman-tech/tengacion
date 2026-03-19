import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { logoutCurrentSession, restoreSession as restoreSessionApi } from "../api";
import {
  clearSessionAccessToken,
  SESSION_LOGOUT_EVENT,
  setSessionAccessToken,
} from "../authSession";
import { cancelAmbientWelcome } from "../services/welcomeVoice";

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

const normalizeUserMedia = (rawUser, activeSessionId = "") => {
  if (!rawUser || typeof rawUser !== "object") {
    return rawUser;
  }
  return {
    ...rawUser,
    activeSessionId: String(activeSessionId || rawUser.activeSessionId || ""),
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const applyUser = useCallback((nextUser, token = "", activeSessionId = "") => {
    const normalized = normalizeUserMedia(nextUser || null, activeSessionId);
    if (token) {
      setSessionAccessToken(token);
    }
    setUser(normalized);
    persistUserSnapshot(normalized);
    setError(null);
    return normalized;
  }, []);

  const hardLogout = useCallback(async ({ remote = false } = {}) => {
    if (remote) {
      try {
        await logoutCurrentSession();
      } catch {
        // Continue with local cleanup even if revoke fails.
      }
    }
    cancelAmbientWelcome();
    clearSessionAccessToken();
    persistUserSnapshot(null);
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;

    const restore = async () => {
      try {
        const payload = await restoreSessionApi();
        if (!alive) {
          return;
        }
        applyUser(payload?.user || null, payload?.token || "", payload?.sessionId || "");
      } catch {
        if (!alive) {
          return;
        }
        clearSessionAccessToken();
        persistUserSnapshot(null);
        setUser(null);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    restore();
    return () => {
      alive = false;
    };
  }, [applyUser]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === "user" && !event.newValue) {
        setUser(null);
      }
    };
    const onForcedLogout = () => {
      hardLogout({ remote: false });
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(SESSION_LOGOUT_EVENT, onForcedLogout);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SESSION_LOGOUT_EVENT, onForcedLogout);
    };
  }, [hardLogout]);

  const login = useCallback(
    (token, userData, activeSessionId = "") => {
      if (!userData) {
        return;
      }
      applyUser(userData, token || "", activeSessionId || "");
    },
    [applyUser]
  );

  const updateUser = useCallback((data) => {
    setUser((current) => {
      const next = current ? normalizeUserMedia({ ...current, ...data }) : current;
      persistUserSnapshot(next);
      return next;
    });
  }, []);

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
