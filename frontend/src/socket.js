import { io } from "socket.io-client";

const SOCKET_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://pyrexxbook.onrender.com";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  withCredentials: true
});

export default socket;
