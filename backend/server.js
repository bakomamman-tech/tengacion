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
const { Server } = require("socket.io");

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

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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

const onlineUsers = new Map();

io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    if (!userId) return;
    socket.userId = userId;
    onlineUsers.set(userId, socket.id);
    io.emit("onlineUsers", [...onlineUsers.keys()]);
  });

  socket.on("disconnect", () => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) onlineUsers.delete(uid);
    }
    io.emit("onlineUsers", [...onlineUsers.keys()]);
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
