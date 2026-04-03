const crypto = require("crypto");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");

const TEMP_UPLOAD_ROOT = path.join(os.tmpdir(), "tengacion-upload-staging");

const ensureUploadTempFile = async (file = {}, { prefix = "upload" } = {}) => {
  if (file?.path) {
    return file.path;
  }

  if (!Buffer.isBuffer(file?.buffer) || file.buffer.length === 0) {
    return "";
  }

  await fsp.mkdir(TEMP_UPLOAD_ROOT, { recursive: true });

  const ext = path.extname(String(file.originalname || file.filename || "")) || "";
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const tempPath = path.join(TEMP_UPLOAD_ROOT, filename);

  await fsp.writeFile(tempPath, file.buffer);
  file.path = tempPath;
  file._tempPathCreated = true;

  return tempPath;
};

const cleanupUploadTempFile = async (file = {}) => {
  if (!file?._tempPathCreated || !file?.path) {
    return;
  }

  await fsp.unlink(file.path).catch(() => null);
  delete file.path;
  delete file._tempPathCreated;
};

const cleanupUploadTempFiles = async (files = []) => {
  await Promise.all((Array.isArray(files) ? files : []).map((file) => cleanupUploadTempFile(file)));
};

module.exports = {
  TEMP_UPLOAD_ROOT,
  ensureUploadTempFile,
  cleanupUploadTempFile,
  cleanupUploadTempFiles,
};
