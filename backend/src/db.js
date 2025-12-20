// db.js
import mongoose from "mongoose";

/**
 * Connect to MongoDB.
 * Usage: await connectMongo(uri);
 * Throws on failure.
 */
export async function connectMongo(uri, opts = {}) {
  if (!uri) {
    throw new Error("MongoDB URI is required");
  }

  const defaultOpts = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    ...opts,
  };

  try {
    await mongoose.connect(uri, defaultOpts);
    console.log("✅ MongoDB connected");

    // ⭐ FIX: Drop old unique index on agentId if it exists (allows migration)
    try {
      if (mongoose.connection.collections["agents"]) {
        await mongoose.connection.collections["agents"].dropIndex("agentId_1");
        console.log("⚠️ Dropped legacy index 'agentId_1'");
      }
      if (mongoose.connection.collections["visualizerscanners"]) {
        await mongoose.connection.collections["visualizerscanners"].dropIndex("ip_1");
        console.log("⚠️ Dropped legacy index 'ip_1' on visualizerscanners");
      }
    } catch (e) {
      // Ignore if index doesn't exist
    }

    return mongoose.connection;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message || err);
    throw err;
  }
}

// also export mongoose if other modules need it
export { mongoose };
