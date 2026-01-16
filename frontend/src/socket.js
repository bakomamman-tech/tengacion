import { io } from "socket.io-client";

// ALWAYS connect to API backend
const URL = "https://tengacion-api.onrender.com";

const socket = io(URL, {
  path: "/socket.io",

  transports: ["websocket", "polling"],
  secure: true,
  withCredentials: true,

  autoConnect: true,

  // AUTH IS DYNAMIC – evaluated on each connect
  auth: (cb) => {
    try {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user") || "null");

      cb({
        token,
        user: user?._id || null
      });
    } catch {
      cb({ token: null, user: null });
    }
  },

  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  timeout: 20000
});

// Auto join after connect
socket.on("connect", () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (user?._id) {
      socket.emit("join", user._id);
    }
  } catch {}
});

// Debug helpers
socket.on("connect_error", (err) => {
  console.warn("⚠ Socket connect error:", err.message);
});

socket.on("disconnect", (reason) => {
  console.log("🔌 Socket disconnected:", reason);
});

export default socket;

