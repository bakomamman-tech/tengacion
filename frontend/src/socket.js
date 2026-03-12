import { io } from "socket.io-client";

import {
  emitAuthLogout,
  getSessionAccessToken,
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
    emitAuthLogout(payload?.message || "Session revoked");
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
