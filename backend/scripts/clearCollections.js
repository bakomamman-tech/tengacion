const path = require('path');
const mongoose = require('mongoose');

// Load env from backend/.env (script is in backend/scripts)
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI is not set in backend/.env. Aborting.');
  process.exit(1);
}

const collectionsToDrop = [
  'users',
  'posts',
  'stories',
  'messages',
  'notifications',
  'otps',
  'videos',
];

const confirmed = process.argv.includes('--yes') || process.argv.includes('-y');

console.log('Mongo URI loaded from backend/.env');
console.log('Collections planned for drop:', collectionsToDrop.join(', '));

if (!confirmed) {
  console.log('\nAborting: pass --yes to confirm destructive action.');
  console.log('Example: node backend/scripts/clearCollections.js --yes');
  process.exit(0);
}

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, { connectTimeoutMS: 10000 });
    console.log('Connected. Dropping collections...');

    const db = mongoose.connection.db;

    for (const name of collectionsToDrop) {
      const exists = (await db.listCollections({ name }).toArray()).length > 0;
      if (exists) {
        await db.collection(name).drop();
        console.log(`Dropped collection: ${name}`);
      } else {
        console.log(`Collection not found (skipped): ${name}`);
      }
    }

    console.log('\nDone. Closing connection.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error while clearing collections:', err.message);
    process.exit(1);
  }
}

run();
