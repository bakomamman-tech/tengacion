import { io } from "socket.io-client";

// Connect DIRECTLY to backend service
const socket = io("https://tengacion-api.onrender.com", {
  transports: ["websocket", "polling"],
  withCredentials: true,
  path: "/socket.io",
  autoConnect: true
});

socket.on("connect_error", (err) => {
  console.log("❌ Socket error:", err.message);
});

export default socket;
