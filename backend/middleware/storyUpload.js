const path = require("path");

const { UPLOAD_LIMITS } = require("../config/uploadLimits");
const { createConfiguredUpload } = require("../utils/memoryUpload");

module.exports = createConfiguredUpload({
  candidates: [
    process.env.PRIVATE_UPLOAD_DIR ? path.resolve(process.env.PRIVATE_UPLOAD_DIR) : "",
  ],
  fallbackDirName: "tengacion-story-uploads",
  storageMode: "disk",
  maxFiles: 1,
  maxFilesErrorMessage: "Stories support one image or video at a time",
  maxFileBytes: UPLOAD_LIMITS.PROFILE_STORY_VIDEO_BYTES,
  maxBytesByCategory: {
    image: UPLOAD_LIMITS.STORY_IMAGE_BYTES,
    video: UPLOAD_LIMITS.PROFILE_STORY_VIDEO_BYTES,
  },
});
