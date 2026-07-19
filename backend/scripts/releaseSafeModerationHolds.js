const mongoose = require("mongoose");

const connectDB = require("../config/db");
const { releaseSafePublicationHolds } = require("../services/moderationPublicationService");

const run = async () => {
  await connectDB();
  const result = await releaseSafePublicationHolds({ logger: console });
  await mongoose.disconnect();
  return result;
};

if (require.main === module) {
  run().catch(async (error) => {
    console.error("Failed to release safe moderation holds:", error?.message || error);
    await mongoose.disconnect().catch(() => null);
    process.exitCode = 1;
  });
}

module.exports = { run };
