import mongoose from "mongoose";
import { config } from "./loadEnv.js";

export async function connectDB() {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log("[DB] MongoDB connected");
  } catch (err) {
    console.error("[DB] Connection failed:", err.message);
    process.exit(1);
  }
}