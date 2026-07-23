import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { config } from "../config/loadEnv.js";

export async function registerUser({ email, password, name }) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    const err = new Error("An account with this email already exists.");
    err.status = 409;
    throw err;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email: email.toLowerCase(), passwordHash, name });
  return { email: user.email, name: user.name };
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await user.comparePassword(password))) {
    const err = new Error("Invalid email or password.");
    err.status = 401;
    throw err;
  }
  const token = jwt.sign({ email: user.email }, config.JWT_SECRET, { expiresIn: "12h" });
  return { token, email: user.email, name: user.name };
}

export function verifySessionToken(token) {
  return jwt.verify(token, config.JWT_SECRET); // throws if invalid/expired
}