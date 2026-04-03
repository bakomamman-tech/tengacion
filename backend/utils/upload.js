const path = require("path");

const { createConfiguredUpload } = require("./memoryUpload");

module.exports = createConfiguredUpload({
  candidates: [
    process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : "",
    path.join(__dirname, "..", "uploads"),
  ],
  fallbackDirName: "tengacion-uploads",
});
