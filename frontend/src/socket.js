import { io } from "socket.io-client";

// Canonical Socket.IO connection (single source of truth)
const socket = io({
  path: "/socket.io",
  withCredentials: true,
  transports: ["polling", "websocket"]
});

export default socket;
