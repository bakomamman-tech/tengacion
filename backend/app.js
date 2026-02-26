const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const auth = require("./middleware/auth");
const upload = require("./utils/upload");
const errorHandler = require("../apps/api/middleware/errorHandler");
const User = require("./models/User");

const app = express();

app.set("trust proxy", 1);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

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

app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/media") || req.path.startsWith("/payments/webhook")) {
    return next();
  }
  return apiLimiter(req, res, next);
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
app.use("/api/artist", require("./routes/artist"));
app.use("/api/music", require("./routes/music"));
app.use("/api/billing", require("./routes/billing"));

app.get("/socket.io", (_, res) => res.send("socket ok"));

app.use(errorHandler);

module.exports = app;
