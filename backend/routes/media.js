const express = require("express");
const mongoose = require("mongoose");
const { getBucket, bucketName } = require("../services/mediaStore");

const router = express.Router();

const parseRange = (rangeHeader, fileSize) => {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
    return null;
  }

  const value = rangeHeader.replace("bytes=", "");
  const [startRaw, endRaw] = value.split("-");
  const start = Number.parseInt(startRaw, 10);
  const end = endRaw ? Number.parseInt(endRaw, 10) : fileSize - 1;

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

    res.setHeader("Content-Length", fileSize);
    const stream = bucket.openDownloadStream(objectId);
    stream.on("error", () => res.end());
    stream.pipe(res);
  } catch (err) {
    console.error("Media stream error:", err);
    res.status(500).send("Media stream failed");
  }
});

module.exports = router;
