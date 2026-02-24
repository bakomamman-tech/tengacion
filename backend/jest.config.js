/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["tests"],
  // Increase timeout because mongodb-memory-server can take a while to spin up.
  testTimeout: 180000,
  setupFilesAfterEnv: [],
};
