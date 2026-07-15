import dotenv from "dotenv";
dotenv.config();

export const config = {
  PORT:             process.env.PORT             || 3001,
  VISUAL_SDK_BASE:  process.env.VISUAL_SDK_BASE  || "https://api.scam2safe.com",
  VISUAL_SDK_API_KEY: process.env.VISUAL_SDK_API_KEY || "",
  JWT_SECRET:       process.env.JWT_SECRET       || "bankguard-dev-secret",
  NODE_ENV:         process.env.NODE_ENV         || "development",
};