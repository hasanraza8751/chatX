const mongoose = require('mongoose');

// Why Mongoose: schemas + validation + indexes on top of MongoDB.
// Phase 1: only connects. Models arrive in later phases.
// serverSelectionTimeoutMS=3000 so a missing local Mongo fails fast
// instead of hanging the boot for 30s.
async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
  console.log(`[db] Connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = connectDB;
