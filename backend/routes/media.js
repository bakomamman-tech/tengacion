const express = require("express");
const mongoose = require("mongoose");
const { getBucket, bucketName } = require("../services/mediaStore");
const { verifySignedMediaToken } = require("../services/mediaSigner");

const router = express.Router();

const toSafeLength = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value && typeof value === "object" && typeof value.toNumber === "function") {
    const converted = value.toNumber();
    if (Number.isFinite(converted)) {
      return converted;
    }
  }

  const raw = value && typeof value.toString === "function" ? value.toString() : "";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const inferContentTypeFromFilename = (filename = "") => {
  const lower = String(filename || "").toLowerCase();
  if (/\.(mp4|m4v)$/i.test(lower)) return "video/mp4";
  if (/\.webm$/i.test(lower)) return "video/webm";
  if (/\.ogg$/i.test(lower)) return "video/ogg";
  if (/\.mov$/i.test(lower)) return "video/quicktime";
  if (/\.avi$/i.test(lower)) return "video/x-msvideo";
  if (/\.mkv$/i.test(lower)) return "video/x-matroska";
  if (/\.png$/i.test(lower)) return "image/png";
  if (/\.(jpg|jpeg)$/i.test(lower)) return "image/jpeg";
  if (/\.gif$/i.test(lower)) return "image/gif";
  if (/\.webp$/i.test(lower)) return "image/webp";
  if (/\.bmp$/i.test(lower)) return "image/bmp";
  if (/\.svg$/i.test(lower)) return "image/svg+xml";
  if (/\.avif$/i.test(lower)) return "image/avif";
  return "application/octet-stream";
};

const parseRange = (rangeHeader, fileSize) => {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
    return null;
  }

  const value = rangeHeader.replace("bytes=", "");
  if (value.includes(",")) {
    return null;
  }

  const [startRaw, endRaw] = value.split("-");
  const hasStart = startRaw !== undefined && startRaw !== "";
  const hasEnd = endRaw !== undefined && endRaw !== "";

  let start = 0;
  let end = fileSize - 1;

  if (hasStart) {
    start = Number.parseInt(startRaw, 10);
    end = hasEnd ? Number.parseInt(endRaw, 10) : fileSize - 1;
  } else if (hasEnd) {
    const suffixLength = Number.parseInt(endRaw, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    return null;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  if (start < 0 || end < start || start >= fileSize) {
    return null;
  }

  return { start, end: Math.min(end, fileSize - 1) };
};

router.get("/signed", async (req, res) => {
  try {
    const token = String(req.query?.token || "");
    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    const payload = verifySignedMediaToken(token);
    const sourceUrl = String(payload?.src || "").trim();
    if (!sourceUrl) {
      return res.status(400).json({ error: "Invalid media token" });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.redirect(sourceUrl);
  } catch {
    return res.status(401).json({ error: "Invalid or expired media token" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).send("Media not found");
    }

    const objectId = new mongoose.Types.ObjectId(id);
    const filesCollection = mongoose.connection.db.collection(`${bucketName}.files`);
    const fileDoc = await filesCollection.findOne({ _id: objectId });

    if (!fileDoc) {
      return res.status(404).send("Media not found");
    }

    const fileSize = toSafeLength(fileDoc.length);
    const mimeType =
      fileDoc.contentType ||
      inferContentTypeFromFilename(fileDoc.filename || "") ||
      "application/octet-stream";
    const originalName =
      fileDoc?.metadata?.originalName ||
      fileDoc?.filename ||
      "media";
    const disposition = fileDoc?.metadata?.contentDisposition || "inline";
    const bucket = getBucket();
    const range = parseRange(req.headers.range, fileSize);

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename=\"${String(originalName).replace(/\"/g, "")}\"`
    );
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    if (range) {
      const { start, end } = range;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", chunkSize);

      const stream = bucket.openDownloadStream(objectId, {
        start,
        end: end + 1,
      });
      stream.on("error", () => res.end());
      stream.pipe(res);
      return;
    }

    if (req.headers.range) {
      res.status(416);
      res.setHeader("Content-Range", `bytes */${fileSize}`);
      return res.end();
    }

    res.setHeader("Content-Length", fileSize);
    const stream = bucket.openDownloadStream(objectId);
    stream.on("error", () => res.end());
    stream.pipe(res);
  } catch (err) {
    console.error("Media stream error:", err);
    res.status(500).send("Media stream failed");
  }
});

router.head("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).end();
    }

    const objectId = new mongoose.Types.ObjectId(id);
    const filesCollection = mongoose.connection.db.collection(`${bucketName}.files`);
    const fileDoc = await filesCollection.findOne({ _id: objectId });

    if (!fileDoc) {
      return res.status(404).end();
    }

    const fileSize = toSafeLength(fileDoc.length);
    const mimeType =
      fileDoc.contentType ||
      inferContentTypeFromFilename(fileDoc.filename || "") ||
      "application/octet-stream";
    const originalName =
      fileDoc?.metadata?.originalName ||
      fileDoc?.filename ||
      "media";
    const disposition = fileDoc?.metadata?.contentDisposition || "inline";
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename=\"${String(originalName).replace(/\"/g, "")}\"`
    );
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.status(200).end();
  } catch (err) {
    console.error("Media head error:", err);
    return res.status(500).end();
  }
});

module.exports = router;
