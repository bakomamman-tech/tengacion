import { io } from "socket.io-client";

/* ======================================================
   FACEBOOK-GRADE SOCKET MANAGER
====================================================== */

const URL = "https://tengacion-api.onrender.com";

let socket = null;

/**
 * Connect socket AFTER authentication
 */
export function connectSocket({ token, userId }) {
  if (socket || !token || !userId) return socket;

  socket = io(URL, {
    path: "/socket.io",
    transports: ["websocket"],
    secure: true,

    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 8000,

    auth: {
      token,
      userId,
    },
  });

  socket.connect();

  socket.on("connect", () => {
    console.log("🔌 Socket connected");
    socket.emit("join", userId);
  });

  socket.on("connect_error", (err) => {
    console.warn("⚠ Socket error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 Socket disconnected:", reason);
  });

  return socket;
}

/**
 * Disconnect socket on logout / unmount
 */
export function disconnectSocket() {
  if (!socket) return;

  socket.disconnect();
  socket = null;
}
