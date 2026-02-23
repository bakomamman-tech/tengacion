/* =====================================================
   🌱 ENV & CONFIG
===================================================== */
require("dotenv").config();
require("./config/env");

const connectDB = require("./config/db");

/* =====================================================
   📦 IMPORTS
===================================================== */
const path = require("path");
const express = require("express");
const cors = require("cors");
const http = require("http");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const User = require("./models/User");
const upload = require("./utils/upload");
const { createNotification } = require("./services/notificationService");
const { persistChatMessage } = require("./services/chatService");
const { toIdString } = require("./utils/messagePayload");
const auth = require("./middleware/auth");

const errorHandler = require("./middleware/errorHandler");

/* =====================================================
   🚀 APP INIT
===================================================== */
const app = express();
const server = http.createServer(app);

/* =====================================================
   🗄 DATABASE
===================================================== */
connectDB();

/* =====================================================
   🧠 TRUST PROXY (RENDER)
===================================================== */
app.set("trust proxy", 1);

/* =====================================================
   🛡 SECURITY
===================================================== */
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        imgSrc: ["'self'", "data:", "blob:", "https://ui-avatars.com"],
        mediaSrc: ["'self'", "data:", "blob:"],
      },
    },
  })
);

/* =====================================================
   🚦 RATE LIMITING (API ONLY)
===================================================== */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/media") || req.path.startsWith("/payments/webhook")) {
    return next();
  }
  return apiLimiter(req, res, next);
});

/* =====================================================
   🌍 CORS
===================================================== */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Private-Network", "true");
  next();
});

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

/* =====================================================
   🧱 CORE MIDDLEWARE
===================================================== */
app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      if (req.originalUrl === "/api/payments/webhook/paystack") {
        req.rawBody = buf.toString("utf8");
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(upload.uploadDir));

/* =====================================================
   ⚡ SOCKET.IO
===================================================== */
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ["polling", "websocket"],
});

app.get("/socket.io", (_, res) => res.send("socket ok"));

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

/* =====================================================
   🧩 API ROUTES
===================================================== */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});
app.get("/api/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json(user);
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/comments", require("./routes/comments"));
app.use("/api/stories", require("./routes/stories"));
app.use("/api/media", require("./routes/media"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/videos", require("./routes/videos"));
app.use("/api/creators", require("./routes/creators"));
app.use("/api/tracks", require("./routes/tracks"));
app.use("/api/books", require("./routes/books"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/purchases", require("./routes/purchases"));
app.use("/api/entitlements", require("./routes/entitlements"));
app.use("/api/chat", require("./routes/chat"));

/* =====================================================
   🌐 FRONTEND (VITE – SAME DOMAIN)
===================================================== */
const frontendPath = path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendPath));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "API route not found" });
  }

  res.sendFile(path.join(frontendPath, "index.html"), (err) => {
    if (err) {
      console.log("⚠ Frontend not built – API mode only");
      res.send("Tengacion API Running");
    }
  });
});

/* =====================================================
   ❗ ERROR HANDLER
===================================================== */
app.use(errorHandler);

/* =====================================================
   🚀 START SERVER
===================================================== */
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Tengacion running on port ${PORT}`);
});
