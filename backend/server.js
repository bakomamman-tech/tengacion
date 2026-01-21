require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

/* =====================================================
   🌍 PRODUCTION GRADE CORS & SECURITY
===================================================== */

// Allow Chrome private network requests (DevTools + Mobile)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Private-Network", "true");
  next();
});

app.use(
  cors({
    origin: true,                // reflect caller origin (Render + Local)
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Length"],
  })
);

// Preflight safety
app.options("*", (req, res) => res.sendStatus(200));

/* =====================================================
   🧱 CORE MIDDLEWARE
===================================================== */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* =====================================================
   🗄 DATABASE CONNECTION
===================================================== */

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI not found in environment variables");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🗄 MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });

/* =====================================================
   ⚡ SOCKET.IO — REALTIME CORE
===================================================== */

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
    methods: ["GET", "POST"],
  },

  // Stability for Render sleep + mobile networks
  transports: ["polling", "websocket"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Render health check
app.get("/socket.io", (req, res) => {
  res.status(200).send("socket ok");
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization;

  console.log(
    "🔌 Socket connected:",
    socket.id,
    "| token:",
    token ? "present" : "missing"
  );

  socket.on("join", (userId) => {
    if (!userId) return;

    socket.userId = userId;
    onlineUsers.set(userId, socket.id);

    io.emit("onlineUsers", Array.from(onlineUsers.keys()));
  });

  socket.on("sendMessage", async ({ senderId, receiverId, text }) => {
    try {
      const Message = require("./models/Message");
      const User = require("./models/User");

      const conversationId = [senderId, receiverId].sort().join("_");

      const sender = await User.findById(senderId).select(
        "name username avatar"
      );

      if (!sender) return;

      const msg = await Message.create({
        conversationId,
        senderId,
        receiverId,
        text,
        time: new Date().toISOString(),
      });

      const payload = {
        _id: msg._id,
        conversationId,
        senderId: sender._id.toString(),
        receiverId,
        text: msg.text,
        senderName: sender.name,
        senderUsername: sender.username,
        senderAvatar: sender.avatar,
        time: msg.time,
      };

      const receiverSocket = onlineUsers.get(receiverId);

      if (receiverSocket) {
        io.to(receiverSocket).emit("newMessage", payload);
      }

      socket.emit("newMessage", payload);
    } catch (err) {
      console.error("❌ Socket message error:", err);
    }
  });

  socket.on("disconnect", () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }

    io.emit("onlineUsers", Array.from(onlineUsers.keys()));
  });
});

/* =====================================================
   🧩 API ROUTES
===================================================== */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date(),
    env: process.env.NODE_ENV || "development",
  });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/stories", require("./routes/stories"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/videos", require("./routes/videos"));

/* =====================================================
   🌐 SERVE FRONTEND (VITE BUILD)
===================================================== */

const frontendPath = path.join(process.cwd(), "frontend", "dist");

app.use(express.static(frontendPath));

// SPA fallback – ALWAYS LAST
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "API route not found" });
  }

  res.sendFile(path.join(frontendPath, "index.html"), (err) => {
    if (err) {
      console.log("⚠ Frontend not built – running API mode only");
      res.status(200).send("Tengacion API Running");
    }
  });
});

/* =====================================================
   🚀 START SERVER — RENDER SAFE
===================================================== */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Tengacion API running on port ${PORT}`);
});

/* =====================================================
   GLOBAL ERROR HANDLER
===================================================== */

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err.message);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
});
