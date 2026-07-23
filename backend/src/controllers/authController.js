import { registerUser, loginUser } from "../services/authService.js";

export async function register(body) {
  return registerUser(body);
}
export async function login(body) {
  return loginUser(body);
}