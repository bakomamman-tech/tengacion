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
const Message = require("./models/Message");
const User = require("./models/User");
const upload = require("./utils/upload");

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

app.use("/api", apiLimiter);

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
app.use(express.json({ limit: "10mb" }));
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

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const buildConversationId = (a, b) =>
  [toIdString(a), toIdString(b)].sort().join("_");

const avatarToUrl = (avatar) => {
  if (!avatar) return "";
  if (typeof avatar === "string") return avatar;
  return avatar.url || "";
};

const normalizeMessage = (message) => {
  const senderDoc =
    message?.senderId && typeof message.senderId === "object"
      ? message.senderId
      : null;

  return {
    _id: toIdString(message._id),
    conversationId: message.conversationId,
    senderId: toIdString(message.senderId),
    receiverId: toIdString(message.receiverId),
    senderName: message.senderName || senderDoc?.name || "",
    senderAvatar: avatarToUrl(senderDoc?.avatar),
    text: message.text,
    status: message.status || "sent",
    time:
      message.time ||
      (message.createdAt ? new Date(message.createdAt).getTime() : Date.now()),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    clientId: message.clientId || null,
  };
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
      const text = (payload.text || "").trim();
      const clientId = (payload.clientId || "").trim();

      if (!senderId) {
        if (typeof ack === "function") {
          ack({ ok: false, error: "Unauthorized socket user" });
        }
        return;
      }

      if (!receiverId || !text || senderId === receiverId) {
        if (typeof ack === "function") {
          ack({ ok: false, error: "Invalid message payload" });
        }
        return;
      }

      const sender = await User.findById(senderId).select("name");
      if (!sender) {
        if (typeof ack === "function") {
          ack({ ok: false, error: "Sender not found" });
        }
        return;
      }

      const conversationId = buildConversationId(senderId, receiverId);
      if (clientId) {
        const existing = await Message.findOne({
          conversationId,
          senderId,
          clientId,
        }).populate("senderId", "name username avatar");

        if (existing) {
          const normalizedExisting = normalizeMessage(existing.toObject());
          io.to(senderId).to(receiverId).emit("newMessage", normalizedExisting);
          if (typeof ack === "function") {
            ack({ ok: true, message: normalizedExisting });
          }
          return;
        }
      }

      const message = await Message.create({
        conversationId,
        senderId,
        receiverId,
        senderName: sender.name || "",
        text,
        time: Date.now(),
        clientId: clientId || undefined,
      });

      await message.populate("senderId", "name username avatar");
      const normalized = normalizeMessage(message.toObject());

      io.to(senderId).to(receiverId).emit("newMessage", normalized);

      if (typeof ack === "function") {
        ack({ ok: true, message: normalized });
      }
    } catch (err) {
      console.error("Socket sendMessage error:", err);
      if (typeof ack === "function") {
        ack({ ok: false, error: "Failed to send message" });
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

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/comments", require("./routes/comments"));
app.use("/api/stories", require("./routes/stories"));
app.use("/api/media", require("./routes/media"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/videos", require("./routes/videos"));

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
