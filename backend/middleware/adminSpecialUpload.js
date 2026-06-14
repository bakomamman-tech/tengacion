const path = require("path");

const { UPLOAD_LIMITS } = require("../config/uploadLimits");
const { createConfiguredUpload } = require("../utils/memoryUpload");

module.exports = createConfiguredUpload({
  candidates: [
    process.env.PRIVATE_UPLOAD_DIR ? path.resolve(process.env.PRIVATE_UPLOAD_DIR) : "",
  ],
  fallbackDirName: "tengacion-admin-special-uploads",
  maxFileBytes: UPLOAD_LIMITS.ADMIN_SPECIAL_BYTES,
  maxBytesByCategory: {
    audio: UPLOAD_LIMITS.ADMIN_SPECIAL_BYTES,
    document: UPLOAD_LIMITS.ADMIN_SPECIAL_BYTES,
    video: UPLOAD_LIMITS.ADMIN_SPECIAL_BYTES,
  },
});
