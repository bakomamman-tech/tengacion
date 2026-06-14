const path = require("path");

const { UPLOAD_LIMITS } = require("../config/uploadLimits");
const { createConfiguredUpload } = require("../utils/memoryUpload");

module.exports = createConfiguredUpload({
  candidates: [
    process.env.PRIVATE_UPLOAD_DIR ? path.resolve(process.env.PRIVATE_UPLOAD_DIR) : "",
  ],
  fallbackDirName: "tengacion-story-uploads",
  maxFileBytes: UPLOAD_LIMITS.PROFILE_STORY_VIDEO_BYTES,
  maxBytesByCategory: {
    image: UPLOAD_LIMITS.IMAGE_BYTES,
    video: UPLOAD_LIMITS.PROFILE_STORY_VIDEO_BYTES,
  },
});
