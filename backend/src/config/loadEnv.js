import dotenv from "dotenv";
dotenv.config();

export const config = {
  PORT:             process.env.PORT             || 3001,
  VISUAL_SDK_BASE:  process.env.VISUAL_SDK_BASE  || "https://api.scam2safe.com",
  VISUAL_SDK_API_KEY: process.env.VISUAL_SDK_API_KEY || "",
  JWT_SECRET:       process.env.JWT_SECRET       || "bankguard-dev-secret",
  NODE_ENV:         process.env.NODE_ENV         || "development",

  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/bankguard",

  YAPILY_APPLICATION_ID:     process.env.YAPILY_APPLICATION_ID || "",
  YAPILY_APPLICATION_SECRET: process.env.YAPILY_APPLICATION_SECRET || "",
  YAPILY_BASE_URL:           process.env.YAPILY_BASE_URL || "https://api.yapily.com",
  YAPILY_CALLBACK_URL:       process.env.YAPILY_CALLBACK_URL || "",
  YAPILY_INSTITUTION_ID:     process.env.YAPILY_INSTITUTION_ID || "modelo-sandbox",
};