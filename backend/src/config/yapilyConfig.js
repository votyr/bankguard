import { config } from "./loadEnv.js";

export const yapilyConfig = {
  applicationId: config.YAPILY_APPLICATION_ID,
  applicationSecret: config.YAPILY_APPLICATION_SECRET,
  baseUrl: config.YAPILY_BASE_URL || "https://api.yapily.com",
  callbackUrl: config.YAPILY_CALLBACK_URL,
  institutionId: config.YAPILY_INSTITUTION_ID || "modelo-sandbox",
};