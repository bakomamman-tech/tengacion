const express = require("express");
const mongoose = require("mongoose");
const { getBucket, bucketName } = require("../services/mediaStore");

const router = express.Router();

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

    const fileSize = Number(fileDoc.length) || 0;
    const mimeType = fileDoc.contentType || "application/octet-stream";
    const bucket = getBucket();
    const range = parseRange(req.headers.range, fileSize);

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", mimeType);
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

    const fileSize = Number(fileDoc.length) || 0;
    const mimeType = fileDoc.contentType || "application/octet-stream";
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.status(200).end();
  } catch (err) {
    console.error("Media head error:", err);
    return res.status(500).end();
  }
});

module.exports = router;
