import { io } from "socket.io-client";

// Same-origin WebSocket (Render + Vercel friendly)
const socket = io("/", {
  transports: ["websocket"],
  withCredentials: true,
  path: "/socket.io"
});

export default socket;
