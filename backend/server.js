require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

/* ================= CORS ================= */
// Same-origin first. No hardcoded frontend URL.
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

/* ================= BODY ================= */

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= DATABASE ================= */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🗄 MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

/* ================= SOCKET.IO ================= */

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("join", (userId) => {
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
        time: new Date().toISOString()
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
        time: msg.time
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

/* ================= API ROUTES ================= */

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/stories", require("./routes/stories"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/videos", require("./routes/videos"));

/* ================= FRONTEND (RENDER) ================= */

// Serve Vite build
const frontendPath = path.join(process.cwd(), "frontend", "dist");
app.use(express.static(frontendPath));

// React Router catch-all (DO NOT override API)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 PyrexxBook running on port ${PORT}`);
});
