/* eslint-disable no-console */
const { io } = require("socket.io-client");

const API_BASE = process.env.API_BASE || "http://localhost:5000/api";
const SOCKET_BASE = process.env.SOCKET_BASE || "http://localhost:5000";
const EMAIL_A = process.env.EMAIL_A;
const PASS_A = process.env.PASS_A;
const EMAIL_B = process.env.EMAIL_B;
const PASS_B = process.env.PASS_B;

if (!EMAIL_A || !PASS_A || !EMAIL_B || !PASS_B) {
  console.error(
    "Missing credentials. Set EMAIL_A, PASS_A, EMAIL_B, PASS_B (and optional API_BASE/SOCKET_BASE)."
  );
  process.exit(1);
}

const json = (value) => JSON.stringify(value, null, 2);

const login = async (email, password) => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Login failed for ${email}: ${response.status}`);
  }
  return response.json();
};

const authedFetch = async (token, path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${body?.error || ""}`.trim());
  }
  return body;
};

const connect = ({ token, userId, label }) =>
  new Promise((resolve, reject) => {
    const socket = io(SOCKET_BASE, {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      withCredentials: true,
      auth: { token, userId },
    });
    socket.on("connect", () => {
      console.log("[SOCKET CONNECT]", { label, socketId: socket.id, userId });
      socket.emit("join", userId);
      console.log("[SOCKET JOIN]", { label, userId });
      resolve(socket);
    });
    socket.on("connect_error", (error) => {
      reject(error);
    });
  });

async function main() {
  const [authA, authB] = await Promise.all([
    login(EMAIL_A, PASS_A),
    login(EMAIL_B, PASS_B),
  ]);
  const userA = authA.user;
  const userB = authB.user;
  const tokenA = authA.token;
  const tokenB = authB.token;

  const [socketA, socketB] = await Promise.all([
    connect({ token: tokenA, userId: userA._id, label: "A" }),
    connect({ token: tokenB, userId: userB._id, label: "B" }),
  ]);

  socketB.on("chat:message", (payload) => {
    console.log("[SOCKET DELIVER]", {
      to: "B",
      serverMsgId: payload?._id,
      fromUserId: payload?.senderId,
      text: payload?.text,
    });
  });
  socketA.on("chat:sent", (payload) => {
    console.log("[SOCKET ACK]", payload);
  });
  socketB.on("friend:request", (payload) => {
    console.log("[SOCKET DELIVER]", {
      to: "B",
      type: "friend:request",
      fromUser: payload?.fromUser,
    });
  });
  socketA.on("friend:accepted", (payload) => {
    console.log("[SOCKET DELIVER]", {
      to: "A",
      type: "friend:accepted",
      friend: payload?.friend,
    });
  });

  const clientMsgId = `repro_${Date.now()}`;
  console.log("[SOCKET SEND]", { fromUserId: userA._id, toUserId: userB._id, clientMsgId });
  await new Promise((resolve, reject) => {
    socketA.emit(
      "chat:send",
      { toUserId: userB._id, text: "hello from repro script", clientMsgId },
      (ack) => {
        if (!ack?.ok) {
          reject(new Error(ack?.error || "chat:send failed"));
          return;
        }
        resolve(ack);
      }
    );
  });

  const messages = await authedFetch(tokenB, `/messages/${userA._id}`);
  console.log("[DB READ]", {
    endpoint: `/api/messages/${userA._id}`,
    count: Array.isArray(messages) ? messages.length : 0,
    last: Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1] : null,
  });

  const sendReq = await authedFetch(tokenA, `/users/${userB._id}/request`, { method: "POST" });
  console.log("[FRIEND SEND]", sendReq);
  const incoming = await authedFetch(tokenB, "/users/requests");
  console.log("[FRIEND FETCH]", { incomingCount: incoming.length, incoming: json(incoming) });
  const accept = await authedFetch(tokenB, `/users/${userA._id}/accept`, { method: "POST" });
  console.log("[FRIEND ACCEPT]", accept);
  const incomingAfter = await authedFetch(tokenB, "/users/requests");
  console.log("[FRIEND UI]", { incomingAfterAccept: incomingAfter.length });

  socketA.disconnect();
  socketB.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
