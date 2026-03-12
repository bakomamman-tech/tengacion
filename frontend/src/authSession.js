let sessionAccessToken = "";
const listeners = new Set();

export const SESSION_LOGOUT_EVENT = "tengacion:auth-logout";

const notifyListeners = () => {
  for (const listener of listeners) {
    try {
      listener(sessionAccessToken);
    } catch {
      // Ignore listener failures.
    }
  }
};

export const getSessionAccessToken = () => sessionAccessToken;

export const setSessionAccessToken = (token = "") => {
  sessionAccessToken = String(token || "").trim();
  notifyListeners();
};

export const clearSessionAccessToken = () => {
  sessionAccessToken = "";
  notifyListeners();
};

export const emitAuthLogout = (reason = "Unauthorized") => {
  clearSessionAccessToken();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SESSION_LOGOUT_EVENT, {
        detail: { reason: String(reason || "Unauthorized") },
      })
    );
  }
};

export const subscribeSessionAccessToken = (listener) => {
  if (typeof listener !== "function") {
    return () => {};
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
};
