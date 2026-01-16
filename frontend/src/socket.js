import { io } from "socket.io-client";

// Always connect directly to backend in production
const URL = import.meta.env.DEV
  ? "http://localhost:5000"
  : "https://tengacion-api.onrender.com";

const socket = io(URL, {
  transports: ["websocket", "polling"],
  withCredentials: true,
  path: "/socket.io",
  autoConnect: true
});

socket.on("connect", () => {
  console.log("🟢 Socket connected:", socket.id);
});

socket.on("connect_error", (err) => {
  console.log("🔴 Socket error:", err.message);
});

export default socket;
