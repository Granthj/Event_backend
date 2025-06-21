const mongoose = require('mongoose');
require('dotenv').config();
let cached = global.__mongooseCache || { conn: null, promise: null };

async function connectToDatabase() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = process.env.DB_URL;
    cached.promise = mongoose.connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// Store in global to prevent multiple connections in dev
// if (process.env.NODE_ENV !== 'production') {
    // }
      global.__mongooseCache = cached;

module.exports = { connectToDatabase };