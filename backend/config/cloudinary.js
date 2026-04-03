const { v2: cloudinary } = require("cloudinary");
const { config } = require("./env");

cloudinary.config({
  cloud_name: config.cloudinaryCloudName || undefined,
  api_key: config.cloudinaryApiKey || undefined,
  api_secret: config.cloudinaryApiSecret || undefined,
  secure: true,
});

const isCloudinaryConfigured = () => Boolean(config.cloudinary?.configured);

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
};
