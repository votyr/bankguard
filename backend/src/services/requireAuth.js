import { verifySessionToken } from "./authService.js";

// Since you're not using Express, call this manually inside route handlers
export function getAuthedEmail(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    const err = new Error("Not authenticated.");
    err.status = 401;
    throw err;
  }
  const token = authHeader.slice(7);
  const payload = verifySessionToken(token);
  return payload.email;
}