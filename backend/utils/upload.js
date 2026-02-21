const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

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
  process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : "",
  path.join(__dirname, "..", "uploads"),
  path.join(os.tmpdir(), "tengacion-uploads"),
].filter(Boolean);

let uploadDir = candidateDirs.find((dir) => tryEnsureWritableDir(dir));
if (!uploadDir) {
  uploadDir = path.join(os.tmpdir(), "tengacion-uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, name + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

upload.uploadDir = uploadDir;
module.exports = upload;
