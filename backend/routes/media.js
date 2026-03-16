const express = require("express");
const mongoose = require("mongoose");

const {
  extractAlbumIdFromSource,
  isAlbumArchiveSource,
  streamAlbumArchive,
} = require("../services/albumArchiveService");
const {
  proxyRemoteMedia,
  streamGridFsMedia,
} = require("../services/mediaDeliveryService");
const { verifySignedMediaToken } = require("../services/mediaSigner");

const router = express.Router();

const SIGNED_CACHE_CONTROL = "private, max-age=300, stale-while-revalidate=86400";

const serveSignedMedia = async (req, res, { token, headOnly = false }) => {
  const payload = verifySignedMediaToken(token);
  const sourceUrl = String(payload?.src || "").trim();
  const disposition = payload?.dl ? "attachment" : "inline";

  if (!sourceUrl) {
    return res.status(400).json({ error: "Invalid media token" });
  }

  if (isAlbumArchiveSource(sourceUrl)) {
    if (headOnly) {
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Cache-Control", SIGNED_CACHE_CONTROL);
      return res.status(200).end();
    }
    await streamAlbumArchive({
      albumId: extractAlbumIdFromSource(sourceUrl),
      res,
    });
    return;
  }

  const localMediaIdMatch = sourceUrl.match(/\/api\/media\/([a-f0-9]{24})(?:$|[/?#])/i);
  if (localMediaIdMatch?.[1] && mongoose.Types.ObjectId.isValid(localMediaIdMatch[1])) {
    const streamed = await streamGridFsMedia({
      req,
      res,
      objectId: new mongoose.Types.ObjectId(localMediaIdMatch[1]),
      disposition,
      cacheControl: SIGNED_CACHE_CONTROL,
      headOnly,
    });
    if (!streamed) {
      return res.status(404).json({ error: "Media not found" });
    }
    return;
  }

  const proxied = await proxyRemoteMedia({
    req,
    res,
    sourceUrl,
    disposition,
    cacheControl: SIGNED_CACHE_CONTROL,
    headOnly,
  });
  if (!proxied) {
    return res.status(404).json({ error: "Media not found" });
  }
};

router.get("/signed", async (req, res) => {
  try {
    const token = String(req.query?.token || "");
    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    verifySignedMediaToken(token);
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(307, `/api/media/delivery/${encodeURIComponent(token)}`);
  } catch {
    return res.status(401).json({ error: "Invalid or expired media token" });
  }
});

router.get("/delivery/:token", async (req, res) => {
  try {
    await serveSignedMedia(req, res, {
      token: req.params.token,
      headOnly: false,
    });
  } catch (error) {
    if (!res.headersSent) {
      return res.status(error?.status || 401).json({ error: error?.message || "Invalid or expired media token" });
    }
  }
});

router.head("/delivery/:token", async (req, res) => {
  try {
    await serveSignedMedia(req, res, {
      token: req.params.token,
      headOnly: true,
    });
  } catch (error) {
    if (!res.headersSent) {
      return res.status(error?.status || 401).end();
    }
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).send("Media not found");
    }

    const streamed = await streamGridFsMedia({
      req,
      res,
      objectId: new mongoose.Types.ObjectId(id),
    });

    if (!streamed) {
      return res.status(404).send("Media not found");
    }
  } catch (error) {
    console.error("Media stream error:", error);
    res.status(500).send("Media stream failed");
  }
});

router.head("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).end();
    }

    const streamed = await streamGridFsMedia({
      req,
      res,
      objectId: new mongoose.Types.ObjectId(id),
      headOnly: true,
    });

    if (!streamed) {
      return res.status(404).end();
    }
  } catch (error) {
    console.error("Media head error:", error);
    res.status(500).end();
  }
});

module.exports = router;
