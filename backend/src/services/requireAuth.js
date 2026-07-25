import { verifySessionToken } from "./authService.js";

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

// NEW — for createPayment to read visualPasswordValue
export function getAuthedUser(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    const err = new Error("Not authenticated.");
    err.status = 401;
    throw err;
  }
  const token = authHeader.slice(7);
  return verifySessionToken(token); // full decoded payload: { userId, email, visualPasswordValue, iat, exp }
}