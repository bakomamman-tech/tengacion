const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const { analyzeImages } = require("./moderationService");

const uniqueStrings = (values = []) => [...new Set(values.filter(Boolean).map((entry) => String(entry)))];

let ffmpegAvailability = null;
const VIDEO_PROBE_TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.MODERATION_VIDEO_PROBE_TIMEOUT_MS || 10000)
);
const VIDEO_FRAME_EXTRACTION_TIMEOUT_MS = Math.max(
  10000,
  Number(process.env.MODERATION_VIDEO_EXTRACTION_TIMEOUT_MS || 30000)
);
const isFfmpegAvailable = () => {
  if (ffmpegAvailability !== null) {
    return ffmpegAvailability;
  }

  try {
    const result = spawnSync("ffmpeg", ["-version"], {
      stdio: "ignore",
      timeout: 5000,
    });
    ffmpegAvailability = result.status === 0;
  } catch {
    ffmpegAvailability = false;
  }

  return ffmpegAvailability;
};

const probeVideoDuration = async (localPath, { signal = null } = {}) =>
  new Promise((resolve) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        localPath,
      ],
      { stdio: ["ignore", "pipe", "ignore"] }
    );
    let settled = false;
    let timeoutId = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      signal?.removeEventListener?.("abort", abortProbe);
      resolve(value);
    };
    const abortProbe = () => {
      child.kill("SIGKILL");
      finish(0);
    };
    signal?.addEventListener?.("abort", abortProbe, { once: true });
    timeoutId = setTimeout(() => {
      child.kill("SIGKILL");
      finish(0);
    }, VIDEO_PROBE_TIMEOUT_MS);
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", () => finish(0));
    child.on("close", (code) => {
      const duration = Number.parseFloat(output.trim());
      finish(code === 0 && Number.isFinite(duration) && duration > 0 ? duration : 0);
    });
  });

const runFfmpegExtract = async ({ localPath, frameDir, durationSec = 0, signal = null }) =>
  new Promise((resolve, reject) => {
    const outputPattern = path.join(frameDir, "frame-%03d.jpg");
    const sampleRate = durationSec > 0
      ? Math.min(1, Math.max(1 / 3600, 12 / durationSec))
      : 1 / 3;
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      localPath,
      "-vf",
      `fps=${sampleRate},scale=640:-1`,
      "-frames:v",
      "12",
      outputPattern,
    ];
    const child = spawn("ffmpeg", args, { stdio: "ignore" });
    let settled = false;
    let timeoutId = null;
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      signal?.removeEventListener?.("abort", abortExtraction);
      if (error) reject(error);
      else resolve();
    };
    const abortExtraction = () => {
      child.kill("SIGKILL");
      finish(new Error("Video frame extraction was interrupted"));
    };
    signal?.addEventListener?.("abort", abortExtraction, { once: true });
    timeoutId = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("Video frame extraction timed out"));
    }, VIDEO_FRAME_EXTRACTION_TIMEOUT_MS);
    child.on("error", finish);
    child.on("close", (code) => {
      if (code === 0) {
        finish();
        return;
      }
      finish(new Error(`ffmpeg exited with code ${code}`));
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

const analyzeVideo = async ({
  localPath,
  mimeType = "",
  originalFilename = "",
  uploaderId = "",
  signal = null,
} = {}) => {
  const normalizedPath = String(localPath || "").trim();
  if (!normalizedPath || !fs.existsSync(normalizedPath)) {
    return {
      decision: "quarantine",
      labels: ["inspection_failed"],
      reason: "Unable to inspect uploaded video.",
      confidence: 0.2,
    };
  }

  const fileHeuristicDecision = await analyzeImages({
    assets: [{
      localPath: normalizedPath,
      mimeType: mimeType || "video/mp4",
      originalFilename,
    }],
    uploaderId,
  });
  if (fileHeuristicDecision.decision === "reject") {
    return fileHeuristicDecision;
  }

  if (!isFfmpegAvailable()) {
    if (process.env.NODE_ENV === "test") {
      return fileHeuristicDecision;
    }
    return {
      decision: "quarantine",
      labels: ["inspection_failed", "video_decoder_unavailable"],
      reason: "Video frame inspection is unavailable; the upload was held for review.",
      confidence: 0.2,
    };
  }

  let frameDir = "";
  try {
    if (signal?.aborted) {
      throw new Error("Video inspection was interrupted");
    }
    frameDir = await fsp.mkdtemp(path.join(os.tmpdir(), "tengacion-video-frames-"));
    const durationSec = await probeVideoDuration(normalizedPath, { signal });
    if (signal?.aborted) {
      throw new Error("Video inspection was interrupted");
    }
    await runFfmpegExtract({ localPath: normalizedPath, frameDir, durationSec, signal });
    const frames = await collectFramePaths(frameDir);
    if (frames.length === 0) {
      return {
        decision: "quarantine",
        labels: ["inspection_failed", "video_frames_missing"],
        reason: "No video frames could be inspected; the upload was held for review.",
        confidence: 0.2,
      };
    }

    const batchResult = await analyzeImages({
      assets: frames.map((framePath) => ({
        localPath: framePath,
        mimeType: "image/jpeg",
      })),
      uploaderId,
    });

    return normalizeAggregatedDecision([fileHeuristicDecision, batchResult]);
  } catch {
    return {
      decision: "quarantine",
      labels: ["inspection_failed", "video_frame_extraction_failed"],
      reason: "Video frame inspection failed; the upload was held for review.",
      confidence: 0.2,
    };
  } finally {
    if (frameDir) {
      await fsp.rm(frameDir, { recursive: true, force: true }).catch(() => null);
    }
  }
};

module.exports = {
  analyzeVideo,
};
