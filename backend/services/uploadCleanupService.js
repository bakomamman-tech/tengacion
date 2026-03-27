const fs = require("fs/promises");
const path = require("path");

const getDefaultUploadDir = () => {
  try {
    return require("../utils/upload").uploadDir;
  } catch {
    return "";
  }
};

const cleanupUploadDir = async ({ uploadDir = "", logger = console } = {}) => {
  const targetDir = path.resolve(String(uploadDir || getDefaultUploadDir() || "").trim());
  if (!targetDir) {
    return {
      uploadDir: "",
      deletedCount: 0,
      freedBytes: 0,
    };
  }

  const entries = await fs.readdir(targetDir, { withFileTypes: true }).catch(() => []);
  const files = entries.filter((entry) => entry.isFile());
  let deletedCount = 0;
  let freedBytes = 0;

  for (const entry of files) {
    const filePath = path.join(targetDir, entry.name);
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat) {
      continue;
    }

    try {
      await fs.unlink(filePath);
      deletedCount += 1;
      freedBytes += Number(stat.size || 0);
    } catch (error) {
      logger?.warn?.(
        `[upload-cleanup] Failed to delete ${filePath}: ${error?.message || error}`
      );
    }
  }

  if (deletedCount > 0) {
    logger?.log?.(
      `[upload-cleanup] Removed ${deletedCount} stale upload file${deletedCount === 1 ? "" : "s"} from ${targetDir} (${Math.round(
        freedBytes / 1024
      )} KB freed)`
    );
  }

  return {
    uploadDir: targetDir,
    deletedCount,
    freedBytes,
  };
};

module.exports = {
  cleanupUploadDir,
};
