import {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
} from "../services/passkeyService.js";

export async function registerOptions(body) {
  return getRegistrationOptions(body.email);
}
export async function registerVerify(body) {
  return verifyRegistration(body.email, body.response);
}
export async function authOptions(body) {
  return getAuthenticationOptions(body.email);
}
export async function authVerify(body) {
  return verifyAuthentication(body.email, body.response);
}