const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const auth = require("./middleware/auth");
const upload = require("./utils/upload");
const errorHandler = require("../apps/api/middleware/errorHandler");
const { config } = require("./config/env");
const User = require("./models/User");
const { normalizeUserMediaDocument } = require("./utils/userMedia");

const app = express();
const isProduction = config.isProduction;
const requestBodyLimit = "2mb";
const allowedOriginSet = new Set(config.allowedOrigins);
const corsOrigin = (origin, callback) => {
  if (!origin || allowedOriginSet.has(origin)) {
    callback(null, true);
    return;
  }

  callback(null, false);
};

app.set("trust proxy", 1);
app.disable("x-powered-by");

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
});
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // Required for LiveKit Cloud: region discovery fetch (/settings/regions)
        // and RTC signaling over WebSocket (/rtc/v1).
        connectSrc: [
          "'self'",
          "https://*.livekit.cloud",
          "wss://*.livekit.cloud",
          "https://tengacioncom-8unikgcj.livekit.cloud",
          "wss://tengacioncom-8unikgcj.livekit.cloud",
        ],
        imgSrc: ["'self'", "data:", "blob:", "https:", "https://ui-avatars.com"],
        mediaSrc: ["'self'", "blob:", "https:"],
        workerSrc: ["'self'", "blob:"],
        scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

app.use("/api", (req, res, next) => {
  if (
    req.path.startsWith("/media") ||
    req.path.startsWith("/payments/webhook") ||
    req.path.startsWith("/marketplace/orders/webhook") ||
    req.path.startsWith("/assistant") ||
    req.path.startsWith("/akuso")
  ) {
    return next();
  }
  return apiLimiter(req, res, next);
});

app.use(
  cors({
    origin: corsOrigin,
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
    limit: requestBodyLimit,
    verify: (req, _res, buf) => {
      const normalizedUrl = String(req.originalUrl || "").split("?")[0];
      if (
        normalizedUrl === "/api/payments/webhook/paystack" ||
        normalizedUrl === "/api/payments/paystack/webhook" ||
        normalizedUrl === "/api/marketplace/orders/webhook/paystack"
      ) {
        req.rawBody = buf.toString("utf8");
      }
    },
  })
);

app.use(express.urlencoded({ extended: true, limit: "512kb", parameterLimit: 1000 }));
app.use("/uploads", express.static(upload.uploadDir));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

app.get("/api/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  normalizeUserMediaDocument(user);
  return res.json(user);
});

app.use("/api/auth", authLimiter, require("../apps/api/routes/auth"));
app.use("/api/admin", adminLimiter, require("../apps/api/routes/admin"));
app.use("/api/moderation", require("./routes/moderation"));
app.use("/api/users", require("./routes/users"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/comments", require("./routes/comments"));
app.use("/api/stories", require("./routes/stories"));
app.use("/api/media", require("./routes/media"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/support", require("./routes/support"));
app.use("/api/talent-show", require("./routes/talentShow"));
app.use("/api/search", require("./routes/search"));
app.use("/api/assistant", require("./routes/assistant"));
app.use("/api/akuso", require("./routes/akuso"));
app.use("/api/videos", require("./routes/videos"));
app.use("/api/live", require("./routes/live"));
app.use("/api/creators", require("./routes/creators"));
app.use("/api/creator", require("./routes/creatorAlbums"));
app.use("/api/creator", require("./routes/creatorRoutes"));
app.use("/api/tracks", require("./routes/tracks"));
app.use("/api/books", require("./routes/books"));
app.use("/api/albums", require("./routes/albums"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/purchases", require("./routes/purchases"));
app.use("/api/entitlements", require("./routes/entitlements"));
app.use("/api", require("./routes/creatorHub"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/artist", require("./routes/artist"));
app.use("/api/music", require("./routes/music"));
app.use("/api/billing", require("./routes/billing"));
app.use("/api/rooms", require("./routes/rooms"));
app.use("/api/checkin", require("./routes/checkin"));
app.use("/api/discovery", require("./routes/discovery"));
app.use("/api/news", require("./routes/news.routes"));
app.use("/api/marketplace", require("./routes/marketplaceRoutes"));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({
      success: false,
      message: "API route not found",
    });
  }

  return next();
});

app.get("/socket.io", (_, res) => res.send("socket ok"));

app.use(errorHandler);

module.exports = app;
