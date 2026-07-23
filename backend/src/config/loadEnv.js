import dotenv from "dotenv";
dotenv.config();

export const config = {
  PORT:             process.env.PORT             || 3001,
  VISUAL_SDK_BASE:  process.env.VISUAL_SDK_BASE  || "https://api.scam2safe.com",
  VISUAL_SDK_API_KEY: process.env.VISUAL_SDK_API_KEY || "",
  JWT_SECRET:       process.env.JWT_SECRET       || "bankguard-dev-secret",
  NODE_ENV:         process.env.NODE_ENV         || "development",

  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/bankguard",

  RAZORPAY_KEY_ID:          process.env.RAZORPAY_KEY_ID || "",
  RAZORPAY_KEY_SECRET:      process.env.RAZORPAY_KEY_SECRET || "",
  RAZORPAY_BASE_URL:        process.env.RAZORPAY_BASE_URL || "https://api.razorpay.com/v1",
  RAZORPAY_ACCOUNT_NUMBER:  process.env.RAZORPAY_ACCOUNT_NUMBER || "",
  
  RP_NAME: process.env.RP_NAME || "BankGuard",
  RP_ID: process.env.RP_ID || "localhost",           // domain, e.g. "bankguard.scam2safe.com" in prod
  RP_ORIGIN: process.env.RP_ORIGIN || "http://localhost:5173",
};