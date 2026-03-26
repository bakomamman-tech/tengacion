const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");

const parsedMaxUploadMb = Number(process.env.MAX_UPLOAD_MB || 200);
const MAX_UPLOAD_MB =
  Number.isFinite(parsedMaxUploadMb) && parsedMaxUploadMb > 0
    ? parsedMaxUploadMb
    : 200;
const MAX_FILE_SIZE_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const tryEnsureWritableDir = (targetDir) => {
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.accessSync(targetDir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

const candidateDirs = [
  process.env.PRIVATE_UPLOAD_DIR ? path.resolve(process.env.PRIVATE_UPLOAD_DIR) : "",
  path.join(os.tmpdir(), "tengacion-private-uploads"),
].filter(Boolean);

let uploadDir = candidateDirs.find((dir) => tryEnsureWritableDir(dir));
if (!uploadDir) {
  uploadDir = path.join(os.tmpdir(), "tengacion-private-uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, name + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

upload.uploadDir = uploadDir;

module.exports = upload;
