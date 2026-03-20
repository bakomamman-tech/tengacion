import { io } from "socket.io-client";

import {
  emitAuthLogout,
  getSessionAccessToken,
  setSessionAccessToken,
  subscribeSessionAccessToken,
} from "./authSession";

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:5000";
};

let socket = null;
let activeToken = "";
let activeUserId = "";
let unsubscribeToken = null;
let sessionRecoveryPromise = null;

const parseRefreshResponse = async (response) => {
  const raw = await response.text();
  let data = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Invalid server response");
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Session refresh failed");
  }

  return data;
};

const refreshSocketSession = async () => {
  if (sessionRecoveryPromise) {
    return sessionRecoveryPromise;
  }

  sessionRecoveryPromise = fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
    .then(parseRefreshResponse)
    .then((payload) => {
      const nextToken = String(payload?.token || "").trim();
      if (!nextToken) {
        throw new Error("Session refresh failed");
      }
      setSessionAccessToken(nextToken);
      return payload;
    })
    .finally(() => {
      sessionRecoveryPromise = null;
    });

  return sessionRecoveryPromise;
};

const recoverSocketSession = async () => {
  const previousToken = String(activeToken || "").trim();
  const payload = await refreshSocketSession();
  const nextToken = String(payload?.token || getSessionAccessToken() || "").trim();

  if (!socket || !activeUserId || !nextToken) {
    return false;
  }

  if (nextToken === previousToken) {
    activeToken = nextToken;
    socket.auth = { token: nextToken, userId: activeUserId };
    if (socket.connected) {
      socket.disconnect().connect();
    } else {
      socket.connect();
    }
  }

  return true;
};

const wireSocketTokenRefresh = () => {
  if (unsubscribeToken) {
    return;
  }

  unsubscribeToken = subscribeSessionAccessToken((nextToken) => {
    if (!socket || !activeUserId) {
      activeToken = nextToken || "";
      return;
    }
    if (String(nextToken || "") === String(activeToken || "")) {
      return;
    }

    activeToken = String(nextToken || "");
    socket.auth = { token: activeToken, userId: activeUserId };
    if (socket.connected) {
      socket.disconnect().connect();
      return;
    }
    socket.connect();
  });
};

export function connectSocket({ token = "", userId }) {
  const nextToken = String(token || getSessionAccessToken() || "").trim();
  if (!nextToken || !userId) {
    return null;
  }

  if (
    socket &&
    socket.connected &&
    activeToken === nextToken &&
    activeUserId === userId
  ) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  activeToken = nextToken;
  activeUserId = userId;

  socket = io(getSocketUrl(), {
    path: "/socket.io",
    transports: ["polling", "websocket"],
    upgrade: true,
    rememberUpgrade: false,
    withCredentials: true,
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1200,
    timeout: 10000,
    auth: {
      token: nextToken,
      userId,
    },
  });

  socket.on("auth:logout", (payload) => {
    recoverSocketSession().catch(() => {
      emitAuthLogout(payload?.message || "Session revoked");
    });
  });

  socket.connect();

  socket.on("connect", () => {
    socket.emit("join", userId);
  });

  socket.on("reconnect", () => {
    socket.emit("join", userId);
  });

  wireSocketTokenRefresh();
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (!socket) {
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  activeToken = "";
  activeUserId = "";
  if (unsubscribeToken) {
    unsubscribeToken();
    unsubscribeToken = null;
  }
}
