import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { config } from "../config/loadEnv.js";
import PasskeyCredential from "../models/PasskeyCredential.js";

// Temporary in-memory challenge store (swap for Mongo/Redis if scaling beyond single instance)
const pendingChallenges = new Map();

export async function getRegistrationOptions(email) {
  const existing = await PasskeyCredential.find({ email });

  const options = await generateRegistrationOptions({
    rpName: config.RP_NAME,
    rpID: config.RP_ID,
    userName: email,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports,
    })),
    authenticatorSelection: {
      residentKey: "required",   // enables discoverable/passkey behavior
      userVerification: "required",
    },
  });

  pendingChallenges.set(email, options.challenge);
  return options;
}

export async function verifyRegistration(email, response) {
  const expectedChallenge = pendingChallenges.get(email);
  if (!expectedChallenge) {
    const err = new Error("No pending registration challenge for this email");
    err.status = 400;
    throw err;
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.RP_ORIGIN,
    expectedRPID: config.RP_ID,
  });

  if (!verification.verified) {
    const err = new Error("Passkey registration failed");
    err.status = 400;
    throw err;
  }

  const { credential } = verification.registrationInfo;

  await PasskeyCredential.create({
    email,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: response.response?.transports || [],
  });

  pendingChallenges.delete(email);
  return { success: true };
}

export async function getAuthenticationOptions(email) {
  const credentials = await PasskeyCredential.find({ email });
  if (credentials.length === 0) {
    const err = new Error("No passkey registered for this account");
    err.status = 404;
    throw err;
  }

  const options = await generateAuthenticationOptions({
    rpID: config.RP_ID,
    userVerification: "required",
    allowCredentials: credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports,
    }))
  });

  pendingChallenges.set(email, options.challenge);
  return options;
}

export async function verifyAuthentication(email, response) {
  const expectedChallenge = pendingChallenges.get(email);
  if (!expectedChallenge) {
    const err = new Error("No pending authentication challenge for this email");
    err.status = 400;
    throw err;
  }

  console.log("AUTH RESPONSE ID:", response.id);
  console.log("ALL STORED:", await PasskeyCredential.find({}));

  const credential = await PasskeyCredential.findOne({
    credentialId: response.id
  });
  if (!credential) {
    const err = new Error("Unknown passkey credential");
    err.status = 404;
    throw err;
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: config.RP_ORIGIN,
    expectedRPID: config.RP_ID,
    authenticator: {
      credentialID: Buffer.from(credential.credentialId, "base64url"),
      credentialPublicKey: Buffer.from(credential.publicKey, "base64url"),
      counter: credential.counter,
    },
  });

  if (!verification.verified) {
    const err = new Error("Passkey verification failed");
    err.status = 401;
    throw err;
  }

  credential.counter = verification.authenticationInfo.newCounter;
  await credential.save();

  pendingChallenges.delete(email);
  return { success: true, email };
}