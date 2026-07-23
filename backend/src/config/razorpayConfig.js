import { config } from "./loadEnv.js";

export const razorpayConfig = {
  keyId: config.RAZORPAY_KEY_ID,
  keySecret: config.RAZORPAY_KEY_SECRET,
  baseUrl: config.RAZORPAY_BASE_URL || "https://api.razorpay.com/v1",
  accountNumber: config.RAZORPAY_ACCOUNT_NUMBER, // RazorpayX virtual account number (test mode)
};