import { io } from "socket.io-client";

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

export function connectSocket({ token, userId }) {
  if (!token || !userId) {return null;}

  if (
    socket &&
    socket.connected &&
    activeToken === token &&
    activeUserId === userId
  ) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  activeToken = token;
  activeUserId = userId;

  socket = io(getSocketUrl(), {
    path: "/socket.io",
    // Polling-first is more reliable on Render cold starts and proxies.
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
      token,
      userId,
    },
  });

  socket.connect();

  socket.on("connect", () => {
    socket.emit("join", userId);
  });

  socket.on("reconnect", () => {
    socket.emit("join", userId);
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (!socket) {return;}

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  activeToken = "";
  activeUserId = "";
}
