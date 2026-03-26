const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const { saveUploadedMedia, getBucket } = require("./mediaStore");

const PRIVATE_STORAGE_ROOT = path.join(os.tmpdir(), "tengacion-private-media");
const TEMP_STORAGE_ROOT = path.join(PRIVATE_STORAGE_ROOT, "temporary");
const QUARANTINE_STORAGE_ROOT = path.join(PRIVATE_STORAGE_ROOT, "quarantine");

const ensureDir = async (dirPath) => {
  await fsp.mkdir(dirPath, { recursive: true });
  return dirPath;
};

const safeName = (value = "") => {
  const base = String(value || "upload").trim();
  const sanitized = base.replace(/[^\w.\-]+/g, "_");
  return sanitized || `upload_${Date.now()}`;
};

const safeSegment = (value = "") => safeName(value).slice(0, 120);

const buildPrivateFileUrl = ({ stage = "quarantine", caseId = "", filename = "" } = {}) => {
  const normalizedStage = String(stage || "quarantine").trim().toLowerCase() || "quarantine";
  const normalizedCaseId = safeSegment(caseId || "unassigned");
  const normalizedFilename = encodeURIComponent(safeName(filename));
  return `private://${normalizedStage}/${normalizedCaseId || "unassigned"}/${normalizedFilename}`;
};

const resolvePrivateMediaPath = (fileUrl = "") => {
  const raw = String(fileUrl || "").trim();
  if (!raw.startsWith("private://")) {
    return "";
  }

  const withoutScheme = raw.replace(/^private:\/\//i, "");
  const [stage = "quarantine", caseId = "unassigned", ...rest] = withoutScheme.split("/");
  const filename = decodeURIComponent(rest.join("/")) || "upload";
  const root =
    stage === "temporary"
      ? TEMP_STORAGE_ROOT
      : QUARANTINE_STORAGE_ROOT;
  const resolvedPath = path.resolve(path.join(root, safeSegment(caseId || "unassigned"), filename));
  const rootPath = path.resolve(root);
  if (!resolvedPath.startsWith(`${rootPath}${path.sep}`) && resolvedPath !== rootPath) {
    return "";
  }
  return resolvedPath;
};

const moveFile = async (sourcePath, destPath) => {
  await ensureDir(path.dirname(destPath));
  try {
    await fsp.rename(sourcePath, destPath);
  } catch (error) {
    if (!error || error.code !== "EXDEV") {
      throw error;
    }
    await fsp.copyFile(sourcePath, destPath);
    await fsp.unlink(sourcePath).catch(() => null);
  }
};

const getSourcePath = (file = {}, filePath = "", fileUrl = "") => {
  if (file?.path) {
    return file.path;
  }
  if (filePath) {
    return filePath;
  }
  if (String(fileUrl || "").startsWith("private://")) {
    return resolvePrivateMediaPath(fileUrl);
  }
  return "";
};

const moveToQuarantineStorage = async ({
  file = null,
  filePath = "",
  fileUrl = "",
  caseId = "",
  stage = "quarantine",
} = {}) => {
  const sourcePath = getSourcePath(file, filePath, fileUrl);
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return {
      fileUrl: fileUrl || "",
      filePath: sourcePath || "",
      originalname: file?.originalname || path.basename(sourcePath || ""),
      mimetype: file?.mimetype || "",
      size: Number(file?.size || 0),
    };
  }

  const originalName = safeName(file?.originalname || path.basename(sourcePath));
  const destDir = await ensureDir(path.join(QUARANTINE_STORAGE_ROOT, safeSegment(caseId || "unassigned")));
  const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const destName = `${uniquePrefix}-${originalName}`;
  const destPath = path.join(destDir, destName);
  await moveFile(sourcePath, destPath);

  return {
    fileUrl: buildPrivateFileUrl({ stage, caseId, filename: destName }),
    filePath: destPath,
    originalname: originalName,
    mimetype: file?.mimetype || "",
    size: Number(file?.size || 0),
  };
};

const promoteToPermanentStorage = async ({
  file = null,
  filePath = "",
  fileUrl = "",
} = {}) => {
  const sourcePath = getSourcePath(file, filePath, fileUrl);
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error("Uploaded file could not be promoted to permanent storage");
  }

  const syntheticFile = {
    path: sourcePath,
    originalname: file?.originalname || path.basename(sourcePath),
    mimetype: file?.mimetype || "application/octet-stream",
    size: Number(file?.size || fs.statSync(sourcePath).size || 0),
    filename: file?.filename || path.basename(sourcePath),
  };

  return saveUploadedMedia(syntheticFile);
};

const deletePermanentStorage = async (publicId = "") => {
  const normalized = String(publicId || "").trim();
  if (!normalized || !mongoose.Types.ObjectId.isValid(normalized)) {
    return false;
  }

  try {
    const bucket = getBucket();
    await bucket.delete(new mongoose.Types.ObjectId(normalized));
    return true;
  } catch {
    return false;
  }
};

const deleteStoredMedia = async ({
  file = null,
  filePath = "",
  fileUrl = "",
  publicId = "",
} = {}) => {
  const sourcePath = getSourcePath(file, filePath, fileUrl);
  if (sourcePath && fs.existsSync(sourcePath)) {
    await fsp.unlink(sourcePath).catch(() => null);
  }

  if (publicId || String(fileUrl || "").startsWith("/api/media/")) {
    const resolvedPublicId =
      publicId ||
      String(fileUrl || "").match(/\/api\/media\/([a-f0-9]{24})(?:$|[/?#])/i)?.[1] ||
      "";
    if (resolvedPublicId) {
      await deletePermanentStorage(resolvedPublicId);
    }
  }

  return true;
};

module.exports = {
  PRIVATE_STORAGE_ROOT,
  QUARANTINE_STORAGE_ROOT,
  TEMP_STORAGE_ROOT,
  buildPrivateFileUrl,
  deletePermanentStorage,
  deleteStoredMedia,
  moveToQuarantineStorage,
  promoteToPermanentStorage,
  resolvePrivateMediaPath,
};
