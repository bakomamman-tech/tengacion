const { config } = require("../apps/api/config/env");
const connectDB = require("./config/db");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { createNotification } = require("./services/notificationService");
const { persistChatMessage } = require("./services/chatService");
const { toIdString } = require("./utils/messagePayload");
const app = require("./app");

const server = http.createServer(app);

if (process.env.NODE_ENV !== "test") {
  connectDB();

  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
    transports: ["polling", "websocket"],
  });

  const onlineUsers = new Map(); // userId -> Set(socketId)

  const emitOnlineUsers = () => {
    io.emit("onlineUsers", [...onlineUsers.keys()]);
  };

  const addOnlineUserSocket = (userId, socketId) => {
    const id = toIdString(userId);
    if (!id) return;
    if (!onlineUsers.has(id)) {
      onlineUsers.set(id, new Set());
    }
    onlineUsers.get(id).add(socketId);
  };

  const removeOnlineUserSocket = (userId, socketId) => {
    const id = toIdString(userId);
    if (!id || !onlineUsers.has(id)) return;
    const sockets = onlineUsers.get(id);
    sockets.delete(socketId);
    if (sockets.size === 0) {
      onlineUsers.delete(id);
    }
  };

  const authenticateSocketUser = (socket) => {
    const token = socket.handshake?.auth?.token;
    const fallbackUserId = toIdString(socket.handshake?.auth?.userId);

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return toIdString(decoded.id);
      } catch {
        return "";
      }
    }

    return fallbackUserId;
  };

  const attachUserToSocket = (socket, userId) => {
    const id = toIdString(userId);
    if (!id) return;
    socket.userId = id;
    socket.join(id);
    addOnlineUserSocket(id, socket.id);
    emitOnlineUsers();
  };

  app.set("io", io);
  app.set("onlineUsers", onlineUsers);

  io.on("connection", (socket) => {
    const initialUserId = authenticateSocketUser(socket);
    if (initialUserId) {
      attachUserToSocket(socket, initialUserId);
    }

    socket.on("join", (userId) => {
      const trustedUserId = initialUserId || authenticateSocketUser(socket);
      const requestedUserId = toIdString(userId);
      if (!trustedUserId || requestedUserId !== trustedUserId) return;
      attachUserToSocket(socket, trustedUserId);
    });

    socket.on("sendMessage", async (payload = {}, ack) => {
      try {
        const senderId = socket.userId || authenticateSocketUser(socket);
        const receiverId = toIdString(payload.receiverId);

        if (!senderId) {
          if (typeof ack === "function") {
            ack({ ok: false, error: "Unauthorized socket user" });
          }
          return;
        }

        if (!receiverId || senderId === receiverId) {
          if (typeof ack === "function") {
            ack({ ok: false, error: "Invalid message payload" });
          }
          return;
        }

        const result = await persistChatMessage({
          senderId,
          receiverId,
          payload: {
            text: payload.text,
            type: payload.type,
            metadata: payload.metadata,
            clientId: payload.clientId,
          },
        });

        io.to(senderId).to(receiverId).emit("newMessage", result.message);

        if (!result.existed) {
          const previewText =
            result.message.type === "contentCard"
              ? `shared: ${result.message.metadata?.title || result.message.metadata?.itemType || "content"}`
              : String(result.message.text || "").slice(0, 120);

          await createNotification({
            recipient: receiverId,
            sender: senderId,
            type: "message",
            text: "sent you a message",
            entity: {
              id: result.message._id,
              model: "Message",
            },
            metadata: {
              previewText,
              link: "/home",
            },
            io,
            onlineUsers,
          });
        }

        if (typeof ack === "function") {
          ack({ ok: true, message: result.message });
        }
      } catch (err) {
        console.error("Socket sendMessage error:", err);
        if (typeof ack === "function") {
          ack({ ok: false, error: err?.message || "Failed to send message" });
        }
      }
    });

    socket.on("disconnect", () => {
      removeOnlineUserSocket(socket.userId, socket.id);
      emitOnlineUsers();
    });
  });

  const PORT = config.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 Tengacion running on port ${PORT}`);
  });
module.exports = server;
