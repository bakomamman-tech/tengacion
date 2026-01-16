import { io } from "socket.io-client";

const URL = "https://tengacion-api.onrender.com";

const socket = io(URL, {
  transports: ["websocket", "polling"],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 10,
  path: "/socket.io"
});

export default socket;
