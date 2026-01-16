import { io } from "socket.io-client";

// Use backend directly in development
const URL =
  import.meta.env.DEV
    ? "http://localhost:5000"
    : "/";   // production = same origin

const socket = io(URL, {
  transports: ["websocket", "polling"],
  withCredentials: true,
  path: "/socket.io"
});

export default socket;
