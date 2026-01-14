require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

/* ================= SOCKET ================= */

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5000",
      process.env.FRONTEND_URL || ""
    ],
    credentials: true
  }
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("onlineUsers", Array.from(onlineUsers.keys()));
  });

  socket.on("sendMessage", async ({ senderId, receiverId, text }) => {
    try {
      const Message = require("./models/Message");
      const User = require("./models/User");

      const conversationId = [senderId, receiverId].sort().join("_");
      const sender = await User.findById(senderId).select("name username avatar");

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
      console.error("Socket message error:", err);
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

/* ================= EXPRESS ================= */

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= DATABASE ================= */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🗄 MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

/* ================= API ROUTES ================= */

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/stories", require("./routes/stories"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/videos", require("./routes/videos"));

/* ================= FRONTEND (PRODUCTION SAFE) ================= */
/*
Render only keeps files inside the backend folder at runtime.
So we copy frontend/dist into backend/frontend during build.
*/

const frontendPath = path.join(process.cwd(), "backend", "frontend");


app.use(express.static(frontendPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log("🚀 Tengacion running on port " + PORT);
});
