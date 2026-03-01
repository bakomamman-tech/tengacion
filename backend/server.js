const http = require("http");
const path = require("path");
const fs = require("fs");
const express = require("express");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { createNotification } = require("./services/notificationService");
const { persistChatMessage } = require("./services/chatService");
const { toIdString } = require("./utils/messagePayload");
const { config } = require("./config/env");
const app = require("./app");
const server = http.createServer(app);
const parsedRequestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 10 * 60 * 1000);
const requestTimeoutMs =
  Number.isFinite(parsedRequestTimeoutMs) && parsedRequestTimeoutMs >= 30000
    ? parsedRequestTimeoutMs
    : 10 * 60 * 1000;
server.requestTimeout = requestTimeoutMs;
server.headersTimeout = requestTimeoutMs + 5000;
server.keepAliveTimeout = 65000;
console.log(`Node ${process.version} starting in ${process.cwd()}`);
console.log(
  `dotenv loaded for backend (NODE_ENV=${config.NODE_ENV || "unknown"}, PORT=${config.PORT || "unset"})`
);

const frontendPath = path.join(__dirname, "../frontend/dist");
const frontendIndex = path.join(frontendPath, "index.html");
const frontendBuilt = fs.existsSync(frontendIndex);

if (frontendBuilt) {
  console.log(`Serving built frontend from ${frontendPath}`);
  app.use(express.static(frontendPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    res.sendFile(frontendIndex, (err) => {
      if (err) {
        console.error("Failed to send frontend index:", err);
        res.status(500).send("Tengacion API Running");
      }
    });
  });
} else {
  console.warn("⚠ Frontend not built – API mode only");
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ message: "API route not found" });
    }

    res.status(503).send("Tengacion API Running – frontend not built");
  });
}

if (process.env.NODE_ENV !== "test") {
  const runPreflight = require("./scripts/preflight");
  const { success } = runPreflight();
  if (!success) {
    console.error("Aborting startup due to failed preflight.");
    process.exit(1);
  }

  const connectDB = require("./config/db");
  connectDB();

  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
    transports: ["polling", "websocket"],
  });

  const onlineUsers = new Map();
  const userRoom = (userId) => `user:${toIdString(userId)}`;
  const logSocket = (tag, payload = {}) => {
    console.log(tag, payload);
  };

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

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return toIdString(decoded.id);
      } catch {
        return "";
      }
    }
    return "";
  };

  const attachUserToSocket = (socket, userId) => {
    const id = toIdString(userId);
    if (!id) return;
    socket.userId = id;
    socket.join(id);
    socket.join(userRoom(id));
    addOnlineUserSocket(id, socket.id);
    emitOnlineUsers();
    logSocket("[SOCKET JOIN]", {
      socketId: socket.id,
      userId: id,
      rooms: [id, userRoom(id)],
    });
  };

  io.use((socket, next) => {
    const userId = authenticateSocketUser(socket);
    logSocket("[SOCKET AUTH]", {
      socketId: socket.id,
      ok: Boolean(userId),
    });
    if (!userId) {
      return next(new Error("Unauthorized"));
    }
    socket.authenticatedUserId = userId;
    return next();
  });

  app.set("io", io);
  app.set("onlineUsers", onlineUsers);

  io.on("connection", (socket) => {
    const initialUserId = socket.authenticatedUserId || authenticateSocketUser(socket);
    attachUserToSocket(socket, initialUserId);
    logSocket("[SOCKET CONNECT]", {
      socketId: socket.id,
      userId: socket.userId,
      transport: socket.conn?.transport?.name,
    });

    socket.on("join", (userId) => {
      const trustedUserId = initialUserId || authenticateSocketUser(socket);
      const requestedUserId = toIdString(userId);
      if (!trustedUserId || requestedUserId !== trustedUserId) return;
      attachUserToSocket(socket, trustedUserId);
    });

    const handleSendMessage = async (payload = {}, ack) => {
      try {
        const senderId = socket.userId || authenticateSocketUser(socket);
        const receiverId = toIdString(payload.receiverId || payload.toUserId);
        const clientMsgId = String(payload.clientId || payload.clientMsgId || "").trim();
        logSocket("[SOCKET SEND]", {
          fromUserId: senderId,
          toUserId: receiverId,
          clientMsgId,
          socketId: socket.id,
        });

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
            attachments: payload.attachments,
            clientId: clientMsgId,
          },
        });
        logSocket("[DB WRITE]", {
          collection: "messages",
          serverMsgId: result.message?._id,
          existed: Boolean(result.existed),
          fromUserId: senderId,
          toUserId: receiverId,
        });

        io.to(senderId).to(receiverId).emit("newMessage", result.message);
        io.to(userRoom(senderId)).to(userRoom(receiverId)).emit("chat:message", result.message);
        io.to(userRoom(receiverId)).emit("chat:deliver", {
          serverMsgId: result.message?._id,
          fromUserId: senderId,
          toUserId: receiverId,
          createdAt: result.message?.createdAt || new Date().toISOString(),
        });
        logSocket("[SOCKET DELIVER]", {
          serverMsgId: result.message?._id,
          fromUserId: senderId,
          toUserId: receiverId,
        });

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
          const ackPayload = {
            ok: true,
            message: result.message,
            serverMsgId: result.message?._id,
            clientMsgId: clientMsgId || null,
            persistedAt: result.message?.createdAt || new Date().toISOString(),
          };
          ack(ackPayload);
          logSocket("[SOCKET ACK]", ackPayload);
        }
        io.to(userRoom(senderId)).emit("chat:sent", {
          serverMsgId: result.message?._id,
          clientMsgId: clientMsgId || null,
          persistedAt: result.message?.createdAt || new Date().toISOString(),
          toUserId: receiverId,
        });
      } catch (err) {
        console.error("Socket sendMessage error:", err);
        if (typeof ack === "function") {
          ack({ ok: false, error: err?.message || "Failed to send message" });
        }
      }
    };

    socket.on("sendMessage", handleSendMessage);
    socket.on("chat:send", handleSendMessage);

    socket.on("disconnect", () => {
      removeOnlineUserSocket(socket.userId, socket.id);
      emitOnlineUsers();
      logSocket("[SOCKET CONNECT]", {
        socketId: socket.id,
        userId: socket.userId || "",
        disconnected: true,
      });
    });
  });

  const PORT = process.env.PORT || config?.PORT || 5000;

  const handleServerError = (error) => {
    if (!error || !error.code) {
      console.error("Server error:", error);
      process.exit(1);
    }

    switch (error.code) {
      case "EADDRINUSE":
        console.error(
          `Port ${PORT} is already in use. Please stop the process using that port or update PORT in your environment.`,
          `Try \`npx kill-port ${PORT}\` or pick a different port.`
        );
        process.exit(1);
        break;
      case "EACCES":
        console.error(`Insufficient permissions to bind to port ${PORT}. Try running with elevated privileges or choose a higher port.`);
        process.exit(1);
        break;
      default:
        console.error("Server error:", error);
        process.exit(1);
    }
  };

  server.on("error", handleServerError);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Tengacion running on port ${PORT}`);
  });
}

module.exports = server;
