require("dotenv").config();
const mongoose = require("mongoose");
const { backfillDailyAnalytics } = require("../services/analyticsService");

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI or MONGODB_URI is required");
  }

  const startDate = process.argv[2];
  const endDate = process.argv[3] || new Date().toISOString().slice(0, 10);

  await mongoose.connect(mongoUri);
  const docs = await backfillDailyAnalytics({ startDate, endDate });
  console.log(`Backfilled ${docs.length} daily analytics rows from ${startDate} to ${endDate}.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
