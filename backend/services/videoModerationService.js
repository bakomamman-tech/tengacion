const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const { analyzeImage } = require("./moderationService");

const uniqueStrings = (values = []) => [...new Set(values.filter(Boolean).map((entry) => String(entry)))];

let ffmpegAvailability = null;
const isFfmpegAvailable = () => {
  if (ffmpegAvailability !== null) {
    return ffmpegAvailability;
  }

  try {
    const result = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
    ffmpegAvailability = result.status === 0;
  } catch {
    ffmpegAvailability = false;
  }

  return ffmpegAvailability;
};

const runFfmpegExtract = async ({ localPath, frameDir }) =>
  new Promise((resolve, reject) => {
    const outputPattern = path.join(frameDir, "frame-%03d.jpg");
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      localPath,
      "-vf",
      "fps=1/3,scale=640:-1",
      "-frames:v",
      "12",
      outputPattern,
    ];
    const child = spawn("ffmpeg", args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });

const collectFramePaths = async (frameDir) => {
  const files = await fsp.readdir(frameDir).catch(() => []);
  return files
    .filter((entry) => /\.(jpg|jpeg|png|webp)$/i.test(entry))
    .sort()
    .map((entry) => path.join(frameDir, entry))
    .slice(0, 12);
};

const normalizeAggregatedDecision = (frameResults = []) => {
  const results = Array.isArray(frameResults) ? frameResults.filter(Boolean) : [];
  if (results.length === 0) {
    return {
      decision: "quarantine",
      labels: ["inspection_failed"],
      reason: "Unable to inspect uploaded video frames.",
      confidence: 0.2,
    };
  }

  const labels = uniqueStrings(results.flatMap((entry) => entry.labels || []));
  const reason = uniqueStrings(results.map((entry) => entry.reason).filter(Boolean)).join(" ");
  const confidence = Math.max(...results.map((entry) => Number(entry.confidence || 0)), 0);

  const hasSexualCriticalLabel = labels.some((entry) =>
    ["suspected_child_exploitation", "explicit_pornography"].includes(String(entry || ""))
  );
  if (hasSexualCriticalLabel) {
    return {
      decision: "reject",
      labels,
      reason: reason || "Video frames indicate prohibited sexual content.",
      confidence: Math.max(confidence, 0.97),
    };
  }

  const rejectCount = results.filter((entry) => entry.decision === "reject").length;
  const quarantineCount = results.filter((entry) => entry.decision === "quarantine").length;
  const violentLabels = labels.filter((entry) =>
    ["graphic_gore", "animal_cruelty"].includes(String(entry || ""))
  );

  if (rejectCount > 0 && (rejectCount >= Math.ceil(results.length * 0.34) || violentLabels.length === 0)) {
    return {
      decision: "reject",
      labels,
      reason: reason || "Video frames indicate prohibited content.",
      confidence: Math.max(confidence, 0.9),
    };
  }

  if (rejectCount > 0 || quarantineCount > 0 || violentLabels.length > 0) {
    return {
      decision: "quarantine",
      labels,
      reason: reason || "Video contains sensitive content requiring review.",
      confidence: Math.max(confidence, 0.72),
    };
  }

  return {
    decision: "approve",
    labels,
    reason: reason || "Video frames passed moderation checks.",
    confidence: Math.max(confidence, 0.15),
  };
};

const analyzeVideo = async ({ localPath, mimeType = "", uploaderId = "" } = {}) => {
  const normalizedPath = String(localPath || "").trim();
  if (!normalizedPath || !fs.existsSync(normalizedPath)) {
    return {
      decision: "quarantine",
      labels: ["inspection_failed"],
      reason: "Unable to inspect uploaded video.",
      confidence: 0.2,
    };
  }

  if (!isFfmpegAvailable()) {
    const fallback = await analyzeImage({ localPath: normalizedPath, mimeType, uploaderId });
    return {
      ...fallback,
      labels: uniqueStrings([...(fallback.labels || []), "video_fallback"]),
    };
  }

  const frameDir = await fsp.mkdtemp(path.join(os.tmpdir(), "tengacion-video-frames-"));
  try {
    await runFfmpegExtract({ localPath: normalizedPath, frameDir });
    const frames = await collectFramePaths(frameDir);
    if (frames.length === 0) {
      const fallback = await analyzeImage({ localPath: normalizedPath, mimeType, uploaderId });
      return {
        ...fallback,
        labels: uniqueStrings([...(fallback.labels || []), "video_fallback"]),
      };
    }

    const results = [];
    for (const framePath of frames) {
      results.push(
        await analyzeImage({
          localPath: framePath,
          mimeType: "image/jpeg",
          uploaderId,
        })
      );
    }

    return normalizeAggregatedDecision(results);
  } catch {
    const fallback = await analyzeImage({ localPath: normalizedPath, mimeType, uploaderId });
    return {
      ...fallback,
      labels: uniqueStrings([...(fallback.labels || []), "video_fallback"]),
    };
  } finally {
    await fsp.rm(frameDir, { recursive: true, force: true }).catch(() => null);
  }
};

module.exports = {
  analyzeVideo,
};
