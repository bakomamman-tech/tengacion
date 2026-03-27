const express = require("express");
const mongoose = require("mongoose");

const {
  extractAlbumIdFromSource,
  isAlbumArchiveSource,
  streamAlbumArchive,
} = require("../services/albumArchiveService");
const {
  streamGridFsMedia,
  streamSourceMedia,
} = require("../services/mediaDeliveryService");
const { buildRestrictedPreviewPath } = require("../services/moderationPolicyService");
const {
  getLatestCaseForMediaId,
  isHiddenFromPublic,
  isRestrictedForPublic,
} = require("../services/moderationService");
const { verifySignedMediaToken } = require("../services/mediaSigner");

const router = express.Router();

const SIGNED_CACHE_CONTROL = "private, max-age=300, stale-while-revalidate=86400";

const resolvePublicMediaAccess = async ({ mediaId, req }) => {
  const moderationCase = await getLatestCaseForMediaId(mediaId);
  if (!moderationCase) {
    return { type: "allow", moderationCase: null, redirectUrl: "" };
  }

  if (isHiddenFromPublic(moderationCase)) {
    return { type: "hidden", moderationCase, redirectUrl: "" };
  }

  if (isRestrictedForPublic(moderationCase)) {
    const matchingAsset = (Array.isArray(moderationCase.media) ? moderationCase.media : []).find(
      (entry) => String(entry?.mediaId || "") === String(mediaId || "")
    );
    return {
      type: "restricted",
      moderationCase,
      redirectUrl:
        String(matchingAsset?.restrictedPreviewUrl || "").trim()
        || buildRestrictedPreviewPath({
          req,
          category: moderationCase.queue,
          severity: moderationCase.severity,
        }),
    };
  }

  return { type: "allow", moderationCase, redirectUrl: "" };
};

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

  const streamed = await streamSourceMedia({
    req,
    res,
    sourceUrl,
    disposition,
    cacheControl: SIGNED_CACHE_CONTROL,
    headOnly,
  });
  if (!streamed) {
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

router.get("/moderation-placeholder.svg", (req, res) => {
  const category = String(req.query.category || "sensitive_content")
    .replace(/[^a-z0-9_ -]/gi, " ")
    .trim()
    .slice(0, 40);
  const severity = String(req.query.severity || "HIGH")
    .replace(/[^a-z0-9_ -]/gi, " ")
    .trim()
    .slice(0, 20);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="Sensitive content placeholder">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#120f14" />
          <stop offset="100%" stop-color="#2f1f1f" />
        </linearGradient>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.16" />
          </feComponentTransfer>
        </filter>
      </defs>
      <rect width="1200" height="675" fill="url(#bg)" />
      <rect width="1200" height="675" filter="url(#grain)" opacity="0.55" />
      <rect x="110" y="110" width="980" height="455" rx="32" fill="rgba(0,0,0,0.28)" stroke="rgba(255,255,255,0.12)" />
      <text x="600" y="290" text-anchor="middle" font-size="32" font-family="Arial, sans-serif" fill="#f4d6d6">
        Sensitive media hidden pending trust and safety rules
      </text>
      <text x="600" y="340" text-anchor="middle" font-size="22" font-family="Arial, sans-serif" fill="#ffd7a8">
        ${category || "sensitive_content"} | severity ${severity || "HIGH"}
      </text>
      <text x="600" y="400" text-anchor="middle" font-size="18" font-family="Arial, sans-serif" fill="#f8efe6">
        Violent or graphic content may be shown only with restricted blurred previews
      </text>
    </svg>
  `.trim();

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(svg);
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).send("Media not found");
    }

    const publicAccess = await resolvePublicMediaAccess({ mediaId: id, req });
    if (publicAccess.type === "hidden") {
      return res.status(404).send("Media not found");
    }
    if (publicAccess.type === "restricted" && publicAccess.redirectUrl) {
      return res.redirect(307, publicAccess.redirectUrl);
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

    const publicAccess = await resolvePublicMediaAccess({ mediaId: id, req });
    if (publicAccess.type === "hidden") {
      return res.status(404).end();
    }
    if (publicAccess.type === "restricted" && publicAccess.redirectUrl) {
      return res.redirect(307, publicAccess.redirectUrl);
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
