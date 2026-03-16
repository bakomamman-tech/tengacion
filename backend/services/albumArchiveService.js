const path = require("path");

const archiver = require("archiver");

const Album = require("../models/Album");
const { buildSignedMediaUrl } = require("./mediaSigner");
const {
  extensionFromContentType,
  openMediaSourceStream,
  sanitizeFilename,
} = require("./mediaDeliveryService");

const ALBUM_ARCHIVE_PROTOCOL = "album://";

const isAlbumArchiveSource = (sourceUrl = "") =>
  String(sourceUrl || "").trim().toLowerCase().startsWith(ALBUM_ARCHIVE_PROTOCOL);

const extractAlbumIdFromSource = (sourceUrl = "") =>
  String(sourceUrl || "")
    .trim()
    .slice(ALBUM_ARCHIVE_PROTOCOL.length)
    .split(/[/?#]/)[0]
    .trim();

const stripKnownExtension = (value = "") => String(value || "").replace(/\.[a-z0-9]{1,8}$/i, "");

const buildAlbumArchiveBaseName = (album) =>
  stripKnownExtension(sanitizeFilename(album?.title || "tengacion-album", "tengacion-album"))
    .replace(/\s+/g, "-")
    .toLowerCase();

const buildTrackArchiveName = (track, index, contentType = "") => {
  const order = String(Number(track?.order || index + 1)).padStart(2, "0");
  const base = stripKnownExtension(sanitizeFilename(track?.title || `Track ${index + 1}`, `Track ${index + 1}`));
  const extension =
    path.extname(String(track?.trackUrl || "").split("?")[0]) ||
    extensionFromContentType(contentType) ||
    ".bin";
  return `tracks/${order} - ${base}${extension}`;
};

const buildAlbumArchiveUrl = ({ albumId, req, userId = "" }) =>
  buildSignedMediaUrl({
    sourceUrl: `${ALBUM_ARCHIVE_PROTOCOL}${String(albumId || "").trim()}`,
    itemType: "album",
    itemId: String(albumId || "").trim(),
    userId,
    allowDownload: true,
    req,
    expiresInSec: 15 * 60,
  });

const streamAlbumArchive = async ({ albumId, res }) => {
  const album = await Album.findOne({
    _id: albumId,
    status: "published",
    isPublished: { $ne: false },
    archivedAt: null,
  }).lean();

  if (!album) {
    const error = new Error("Album not found");
    error.status = 404;
    throw error;
  }

  const tracks = (Array.isArray(album.tracks) ? album.tracks : [])
    .slice()
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

  const archiveBaseName = buildAlbumArchiveBaseName(album);
  const archiveFilename = `${archiveBaseName}.zip`;
  const missingAssets = [];

  res.status(200);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${archiveFilename.replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "private, max-age=300, stale-while-revalidate=86400");

  const archive = archiver("zip", {
    zlib: { level: 8 },
  });
  const completion = new Promise((resolve, reject) => {
    archive.on("error", reject);
    res.on("close", resolve);
    res.on("finish", resolve);
  });

  archive.pipe(res);

  archive.append(
    JSON.stringify(
      {
        albumId: String(album._id),
        title: album.title || "",
        description: album.description || "",
        totalTracks: tracks.length,
        exportedAt: new Date().toISOString(),
        tracks: tracks.map((track, index) => ({
          order: Number(track.order || index + 1),
          title: track.title || `Track ${index + 1}`,
        })),
      },
      null,
      2
    ),
    { name: "manifest.json" }
  );

  if (album.coverUrl) {
    try {
      const coverAsset = await openMediaSourceStream(album.coverUrl);
      const extension =
        path.extname(String(coverAsset.filename || "")) ||
        extensionFromContentType(coverAsset.contentType) ||
        ".jpg";
      archive.append(coverAsset.stream, {
        name: `artwork/cover${extension}`,
      });
    } catch (error) {
      missingAssets.push(`Cover image could not be added: ${error.message || "Unknown error"}`);
    }
  }

  for (let index = 0; index < tracks.length; index += 1) {
    const track = tracks[index];
    try {
      const asset = await openMediaSourceStream(track.trackUrl || "");
      archive.append(asset.stream, {
        name: buildTrackArchiveName(track, index, asset.contentType),
      });
    } catch (error) {
      missingAssets.push(
        `Track ${Number(track.order || index + 1)} (${track.title || `Track ${index + 1}`}) could not be added: ${
          error.message || "Unknown error"
        }`
      );
    }
  }

  if (missingAssets.length) {
    archive.append(
      [
        "Some assets could not be packaged for this export.",
        "",
        ...missingAssets,
      ].join("\n"),
      { name: "archive-notes.txt" }
    );
  }

  await archive.finalize();
  await completion;
};

module.exports = {
  buildAlbumArchiveUrl,
  extractAlbumIdFromSource,
  isAlbumArchiveSource,
  streamAlbumArchive,
};
