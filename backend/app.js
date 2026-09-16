const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const compression = require("compression");

const { connectDB } = require("./config/db");
const { requestId } = require("./middleware/requestId");
const { errorHandler } = require("./middleware/errorHandler");
const { initializeSocket } = require("./socket");
const { logger } = require("./utils/logger");
const { configureTrustProxy } = require("./config/trustProxy");
const { corsOptions } = require("./config/cors");
const { apiLimiter, authLimiter, passwordResetLimiter, otpLimiter, uploadLimiter, searchLimiter, routeAnalyticsLimiter } = require("./middleware/rateLimiters");
const { sanitizePayload } = require("./middleware/sanitizePayload");

require("dotenv").config();

const app = express();
configureTrustProxy(app);

app.disable("x-powered-by");

app.use(requestId);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(sanitizePayload);

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "tengacion-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "tengacion-api",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/password-reset", passwordResetLimiter, require("./routes/passwordReset"));
app.use("/api/otp", otpLimiter, require("./routes/otp"));
app.use("/api/uploads", uploadLimiter, require("./routes/uploads"));
app.use("/api/search", searchLimiter, require("./routes/search"));
app.use("/api", apiLimiter);

app.use("/api/users", require("./routes/users"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/comments", require("./routes/comments"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/follows", require("./routes/follows"));
app.use("/api/friends", require("./routes/friends"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/reels", require("./routes/reels"));
app.use("/api/live", require("./routes/live"));
app.use("/api/creators", require("./routes/creators"));
app.use("/api/creator", require("./routes/creator"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/admin", require("./routes/adminAssistant"));
app.use("/api/admin", require("./routes/adminBookReview"));
app.use("/api/assurance", require("./routes/assurance"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/purchases", require("./routes/purchases"));
app.use("/api/entitlements", require("./routes/entitlements"));
app.use("/api", require("./routes/creatorHub"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/artist", require("./routes/artist"));
app.use("/api/music", require("./routes/music"));
app.use("/api/billing", require("./routes/billing"));
app.use("/api/rooms", require("./routes/rooms"));
app.use("/api/groups", require("./routes/groups"));
app.use("/api/checkin", require("./routes/checkin"));
app.use("/api/discovery", require("./routes/discovery"));
app.use("/api/analytics", routeAnalyticsLimiter, require("./routes/analytics"));
app.use("/api/news", require("./routes/news.routes"));
app.use("/api/marketplace", require("./routes/marketplaceRoutes"));
app.use("/api/schools", require("./routes/schools"));
app.use("/api/teacher-training", require("./routes/teacherTraining"));
app.use("/api/tengaharvest", require("./routes/tengaharvest"));
app.use("/api/tengaagent/owner", require("./routes/tengaAgentOwner"));
app.use("/api/tengaagent/public", require("./routes/tengaAgentPublic"));
app.use("/api/tengaagent", require("./routes/tengaAgent"));

app.get(
  [
    "/AI-Professionals-In-Kaduna-State",
    /^\/kadahive(?:\/.*)?$/i,
    /^\/admin\/institutions\/kadahive(?:\/.*)?$/i,
  ],
  (_req, res) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex,nofollow",
    });
    return res.status(410).type("text/plain").send("This page has been removed.");
  }
);

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      error: "Not found",
      requestId: req.id,
    });
  }
  next();
});

app.use(errorHandler);

module.exports = app;
