import { io } from "socket.io-client";

const URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") ||
  "https://tengacion-api.onrender.com";

const socket = io(URL, {
  transports: ["websocket", "polling"],
  withCredentials: true
});

export default socket;
