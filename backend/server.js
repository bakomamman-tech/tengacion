const http = require("http");
const path = require("path");
const fs = require("fs");
const express = require("express");
const { Server } = require("socket.io");
const { createNotification } = require("./services/notificationService");
const {
  SessionAuthError,
  authenticateAccessToken,
  extractBearerToken,
} = require("./services/sessionAuth");
const { persistChatMessage } = require("./services/chatService");
const { toIdString } = require("./utils/messagePayload");
const Message = require("./models/Message");
const { config } = require("./config/env");
const app = require("./app");
const server = http.createServer(app);
const allowedOriginSet = new Set(config.allowedOrigins);
const corsOrigin = (origin, callback) => {
  if (!origin || allowedOriginSet.has(origin)) {
    callback(null, true);
    return;
  }

  callback(null, false);
};
const parsedRequestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 10 * 60 * 1000);
const requestTimeoutMs =
  Number.isFinite(parsedRequestTimeoutMs) && parsedRequestTimeoutMs >= 30000
    ? parsedRequestTimeoutMs
    : 10 * 60 * 1000;
server.requestTimeout = requestTimeoutMs;
server.headersTimeout = requestTimeoutMs + 5000;
server.keepAliveTimeout = 65000;
console.log(`Node ${process.version} starting in ${process.cwd()}`);
console.log("Backend runtime config", {
  nodeEnv: config.nodeEnv || config.NODE_ENV || "unknown",
  port: process.env.PORT || config.port || config.PORT || "unset",
  allowedOrigins: Array.isArray(config.allowedOrigins) ? config.allowedOrigins.length : 0,
  cloudinaryReady: Boolean(config.cloudinary?.configured),
});
console.log("[assistant]", {
  enabled: Boolean(config.assistantEnabled),
  provider: config.hasOpenAI ? "openai" : "local-fallback",
  model: config.openAiModel || config.OPENAI_MODEL || "unset",
});

const missingAuthSecrets = [
  !String(config.JWT_REFRESH_SECRET || "").trim() ? "JWT_REFRESH_SECRET" : "",
  !String(config.AUTH_CHALLENGE_SECRET || "").trim() ? "AUTH_CHALLENGE_SECRET" : "",
].filter(Boolean);

if (missingAuthSecrets.length > 0) {
  console.warn(
    "Missing auth token env vars. Refresh and step-up flows will fail until these are set:",
    missingAuthSecrets.join(", ")
  );
}

const parsedSocketAuthCacheMs = Number(process.env.SOCKET_AUTH_CACHE_MS || 30000);
const SOCKET_AUTH_CACHE_MS =
  Number.isFinite(parsedSocketAuthCacheMs) && parsedSocketAuthCacheMs >= 5000
    ? parsedSocketAuthCacheMs
    : 30000;
const parsedSocketRevalidateMs = Number(process.env.SOCKET_REVALIDATE_MS || 60000);
const SOCKET_REVALIDATE_MS =
  Number.isFinite(parsedSocketRevalidateMs) && parsedSocketRevalidateMs >= 10000
    ? parsedSocketRevalidateMs
    : 60000;

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
  const { repairUserMediaFields } = require("./scripts/repairUserMediaFields");
  const { repairUserProfileIndexes } = require("./scripts/repairUserProfileIndexes");
  const { repairUserSecurityFields } = require("./scripts/repairUserSecurityFields");
  const { runBirthdayRecognition } = require("./services/birthdayService");
  const { startNewsSchedulers } = require("./services/newsSchedulerService");
  const { startPaymentMaintenance } = require("./services/paymentMaintenanceService");
  const { startWalletMaintenance } = require("./services/walletService");
  const { cleanupUploadDir } = require("./services/uploadCleanupService");
  const { runCleanup } = require("./services/storageMaintenanceService");
  const privateUpload = require("./middleware/privateUpload");

  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
    transports: ["polling", "websocket"],
  });

  const DEFAULT_STORAGE_CLEANUP_ACTIONS = [
    "staleNotifications",
    "expiredAuthArtifacts",
    "staleLogs",
    "temporaryUploads",
    "orphanedMedia",
    "duplicateMedia",
  ];

  const runStorageCleanupJob = async (reason = "scheduled") => {
    try {
      const result = await runCleanup(DEFAULT_STORAGE_CLEANUP_ACTIONS);
      console.log("[storage-cleanup]", {
        reason,
        totals: result.totals,
        actions: result.actions,
      });
      return result;
    } catch (error) {
      console.error("[storage-cleanup] failed", { reason, message: error?.message || error });
      return null;
    }
  };

  setTimeout(() => {
    runStorageCleanupJob("startup").catch(() => null);
  }, 5 * 60 * 1000);

  setInterval(() => {
    runStorageCleanupJob("interval").catch(() => null);
  }, 24 * 60 * 60 * 1000);

  const onlineUsers = new Map();
  const sessionSockets = new Map();
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

  const addSessionSocket = (sessionId, socketId) => {
    const id = String(sessionId || "").trim();
    if (!id) return;
    if (!sessionSockets.has(id)) {
      sessionSockets.set(id, new Set());
    }
    sessionSockets.get(id).add(socketId);
  };

  const removeSessionSocket = (sessionId, socketId) => {
    const id = String(sessionId || "").trim();
    if (!id || !sessionSockets.has(id)) return;
    const sockets = sessionSockets.get(id);
    sockets.delete(socketId);
    if (sockets.size === 0) {
      sessionSockets.delete(id);
    }
  };

  const emitSocketLogout = (socket, { code = "SESSION_REVOKED", message = "" } = {}) => {
    if (!socket || socket.disconnected) {
      return;
    }

    socket.emit("auth:logout", {
      code,
      message: message || "Session revoked. Please login again.",
    });
  };

  const disconnectSocketForAuth = (socket, errorOrPayload = {}) => {
    if (!socket || socket.disconnected) {
      return false;
    }

    const payload =
      typeof errorOrPayload === "string"
        ? { code: "SESSION_REVOKED", message: errorOrPayload }
        : {
            code: errorOrPayload?.code || "SESSION_REVOKED",
            message: errorOrPayload?.message || "Session revoked. Please login again.",
          };

    emitSocketLogout(socket, payload);
    socket.disconnect(true);
    return false;
  };

  const disconnectSessionSockets = (
    sessionId,
    { code = "SESSION_REVOKED", message = "Session revoked. Please login again." } = {}
  ) => {
    const id = String(sessionId || "").trim();
    if (!id || !sessionSockets.has(id)) {
      return 0;
    }

    let disconnected = 0;
    for (const socketId of [...sessionSockets.get(id)]) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;
      disconnectSocketForAuth(socket, { code, message });
      disconnected += 1;
    }

    return disconnected;
  };

  const disconnectUserSockets = (
    userId,
    {
      exceptSessionId = "",
      code = "ACCOUNT_REVOKED",
      message = "Account access changed. Please login again.",
    } = {}
  ) => {
    const id = toIdString(userId);
    if (!id || !onlineUsers.has(id)) {
      return 0;
    }

    let disconnected = 0;
    for (const socketId of [...onlineUsers.get(id)]) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;
      if (exceptSessionId && String(socket.sessionId || "") === String(exceptSessionId || "")) {
        continue;
      }
      disconnectSocketForAuth(socket, { code, message });
      disconnected += 1;
    }
    return disconnected;
  };

  const getSocketToken = (socket) => {
    const authToken = socket?.handshake?.auth?.token;
    if (authToken) {
      return String(authToken).trim();
    }
    return extractBearerToken(socket?.handshake?.headers?.authorization || "");
  };

  const authenticateSocketContext = async (socket) => {
    const token = getSocketToken(socket);
    return authenticateAccessToken(token, { touchSession: false });
  };

  const refreshSocketAuthContext = async (socket, { force = false } = {}) => {
    if (!socket || socket.disconnected) {
      return false;
    }

    const lastValidatedAt = Number(socket.authValidatedAt || 0);
    if (!force && lastValidatedAt && Date.now() - lastValidatedAt < SOCKET_AUTH_CACHE_MS) {
      return true;
    }

    try {
      const authContext = await authenticateSocketContext(socket);
      const userId = toIdString(authContext.user._id);
      const sessionId = String(authContext.sessionId || "").trim();

      if (
        (socket.userId && socket.userId !== userId) ||
        (socket.sessionId && socket.sessionId !== sessionId)
      ) {
        throw new SessionAuthError(
          "Session invalid. Please login again.",
          "SESSION_CONTEXT_MISMATCH",
          401
        );
      }

      socket.userId = userId;
      socket.sessionId = sessionId;
      socket.authValidatedAt = Date.now();
      socket.authTokenVersion = authContext.tokenVersion;
      return true;
    } catch (err) {
      return disconnectSocketForAuth(socket, err);
    }
  };

  const attachUserToSocket = (socket, authContext) => {
    const id = toIdString(authContext?.user?._id || authContext?.userId || socket.userId);
    const sessionId = String(authContext?.sessionId || socket.sessionId || "").trim();
    if (!id) return;
    socket.userId = id;
    socket.sessionId = sessionId;
    socket.authValidatedAt = Date.now();
    socket.join(id);
    socket.join(userRoom(id));
    addOnlineUserSocket(id, socket.id);
    addSessionSocket(sessionId, socket.id);
    emitOnlineUsers();
    logSocket("[SOCKET JOIN]", {
      socketId: socket.id,
      userId: id,
      sessionId,
      rooms: [id, userRoom(id)],
    });
  };

  io.use(async (socket, next) => {
    try {
      const authContext = await authenticateSocketContext(socket);
      logSocket("[SOCKET AUTH]", {
        socketId: socket.id,
        ok: true,
        userId: authContext.userId,
        sessionId: authContext.sessionId,
      });
      socket.authenticatedContext = authContext;
      return next();
    } catch (err) {
      logSocket("[SOCKET AUTH]", {
        socketId: socket.id,
        ok: false,
        code: err?.code || "UNAUTHORIZED",
      });
      return next(new Error(err?.message || "Unauthorized"));
    }
  });

  app.set("io", io);
  app.set("onlineUsers", onlineUsers);
  app.set("realtimeSecurity", {
    disconnectSession: disconnectSessionSockets,
    disconnectUser: disconnectUserSockets,
    disconnectUserSessionsExcept: (userId, exceptSessionId, options = {}) =>
      disconnectUserSockets(userId, { ...options, exceptSessionId }),
  });

  io.on("connection", (socket) => {
    const initialAuthContext = socket.authenticatedContext || null;
    attachUserToSocket(socket, initialAuthContext);
    logSocket("[SOCKET CONNECT]", {
      socketId: socket.id,
      userId: socket.userId,
      sessionId: socket.sessionId || "",
      transport: socket.conn?.transport?.name,
    });

    socket.use((packet, next) => {
      refreshSocketAuthContext(socket)
        .then((ok) => {
          if (!ok) {
            next(new Error("Unauthorized"));
            return;
          }
          next();
        })
        .catch(() => {
          next(new Error("Unauthorized"));
        });
    });

    const sessionRecheckTimer = setInterval(() => {
      if (socket.disconnected) {
        clearInterval(sessionRecheckTimer);
        return;
      }
      refreshSocketAuthContext(socket, { force: true }).catch(() => null);
    }, SOCKET_REVALIDATE_MS);
    sessionRecheckTimer.unref?.();

    socket.on("join", (userId) => {
      const trustedUserId = socket.userId || "";
      const requestedUserId = toIdString(userId);
      if (!trustedUserId || requestedUserId !== trustedUserId) return;
      attachUserToSocket(socket, {
        userId: trustedUserId,
        sessionId: socket.sessionId || "",
      });
    });

    const handleSendMessage = async (payload = {}, ack) => {
      try {
        const senderId = socket.userId || "";
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
            replyTo: payload.replyTo,
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

    socket.on("chat:typing", ({ chatId, isTyping, toUserId }) => {
      const fromUserId = socket.userId || "";
      if (!fromUserId) return;
      const room = toUserId ? userRoom(toUserId) : String(chatId || "");
      if (!room) return;
      io.to(room).emit("chat:typing", {
        chatId: String(chatId || ""),
        fromUserId,
        isTyping: Boolean(isTyping),
      });
    });

    socket.on("chat:recording", ({ chatId, isRecording, toUserId }) => {
      const fromUserId = socket.userId || "";
      if (!fromUserId) return;
      const room = toUserId ? userRoom(toUserId) : String(chatId || "");
      if (!room) return;
      io.to(room).emit("chat:recording", {
        chatId: String(chatId || ""),
        fromUserId,
        isRecording: Boolean(isRecording),
      });
    });

    socket.on("message:react", async ({ messageId, emoji }) => {
      try {
        const userId = socket.userId || "";
        if (!userId || !messageId || !emoji) return;
        const message = await Message.findById(messageId);
        if (!message) return;

        const idx = (message.reactions || []).findIndex(
          (entry) => toIdString(entry.userId) === userId
        );
        if (idx >= 0) {
          if (message.reactions[idx].emoji === emoji) {
            message.reactions.splice(idx, 1);
          } else {
            message.reactions[idx].emoji = String(emoji).slice(0, 8);
            message.reactions[idx].createdAt = new Date();
          }
        } else {
          message.reactions.push({
            userId,
            emoji: String(emoji).slice(0, 8),
            createdAt: new Date(),
          });
        }

        await message.save();
        io.to(userRoom(toIdString(message.senderId)))
          .to(userRoom(toIdString(message.receiverId)))
          .emit("message:reaction", { messageId, reactions: message.reactions });
      } catch (err) {
        console.error("Socket message reaction failed:", err);
      }
    });

    socket.on("watch:join", ({ chatId }) => {
      if (!chatId) return;
      socket.join(`watch:${chatId}`);
    });

    socket.on("watch:state", ({ chatId, videoUrl, t, isPlaying }) => {
      if (!chatId) return;
      socket.to(`watch:${chatId}`).emit("watch:state", {
        chatId,
        videoUrl: String(videoUrl || ""),
        t: Number(t) || 0,
        isPlaying: Boolean(isPlaying),
      });
    });

    socket.on("watch:play", ({ chatId, t }) => {
      if (!chatId) return;
      socket.to(`watch:${chatId}`).emit("watch:play", { chatId, t: Number(t) || 0 });
    });

    socket.on("watch:pause", ({ chatId, t }) => {
      if (!chatId) return;
      socket.to(`watch:${chatId}`).emit("watch:pause", { chatId, t: Number(t) || 0 });
    });

    socket.on("watch:seek", ({ chatId, t }) => {
      if (!chatId) return;
      socket.to(`watch:${chatId}`).emit("watch:seek", { chatId, t: Number(t) || 0 });
    });

    socket.on("room:join", ({ roomId }) => {
      if (!roomId) return;
      socket.join(`room:${roomId}`);
    });

    socket.on("disconnect", () => {
      removeOnlineUserSocket(socket.userId, socket.id);
      removeSessionSocket(socket.sessionId, socket.id);
      clearInterval(sessionRecheckTimer);
      emitOnlineUsers();
      logSocket("[SOCKET DISCONNECT]", {
        socketId: socket.id,
        userId: socket.userId || "",
        sessionId: socket.sessionId || "",
        disconnected: true,
      });
    });
  });

  const PORT = process.env.PORT || config?.PORT || config?.port || 5000;

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
  const listenNow = server.listen.bind(server);
  server.listen = (...args) => {
    const callback = typeof args[args.length - 1] === "function" ? args.pop() : () => {};

    (async () => {
      await connectDB();

      try {
        await cleanupUploadDir({ logger: console });
        await cleanupUploadDir({ uploadDir: privateUpload.uploadDir, logger: console });
        await repairUserProfileIndexes({ logger: console });
        await repairUserMediaFields({ logger: console });
        await repairUserSecurityFields({ logger: console });
        await runBirthdayRecognition({ logger: console });
        await startPaymentMaintenance({ logger: console });
        await startWalletMaintenance({ logger: console });
        await startNewsSchedulers({ logger: console });
      } catch (err) {
        console.error("Startup repair failed:", err?.message || err);
      }

      setInterval(() => {
        runBirthdayRecognition({ logger: console }).catch((err) => {
          console.error("Birthday recognition task failed:", err?.message || err);
        });
      }, 60 * 60 * 1000);

      listenNow(...args, callback);
    })().catch((err) => {
      console.error("Server bootstrap failed:", err?.message || err);
      process.exit(1);
    });

    return server;
  };

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Tengacion running on port ${PORT}`);
  });
}

module.exports = server;
