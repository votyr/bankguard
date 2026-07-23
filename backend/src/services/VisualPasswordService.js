//src/services/visualPasswordService.js

import axios from "axios";
import { config } from "../config/loadEnv.js";

const sdk = axios.create({
    baseURL: config.VISUAL_SDK_BASE,
    timeout: 12000,
    headers: {
        "Content-Type": "application/json",
        "x-api-key": config.VISUAL_SDK_API_KEY,
    },
});

sdk.interceptors.response.use(
    (response) => {
        console.log("[SDK ←]", response.status, response.data);
        return response;
    },
    (error) => {
        console.log("[SDK ERROR]");
        console.log(error.response?.status);
        console.log(error.response?.data);
        throw error;
    }
);

// --- Transaction verification (now number-box based) ---
export async function startTransactionChallenge({ email, transactionId }) {
    const { data } = await sdk.post(
        "/api/sdk/numbers/transaction/start",
        {
        email,
        transactionId,
        }
    );

    if (!data.success) {
        throw new Error(data.error || "SDK failed to start challenge");
    }

    return data;
}

export async function verifyTransactionChallenge({
    sessionId,
    registerInputs,
    }) {
    const { data } = await sdk.post(
        "/api/sdk/numbers/transaction/verify",
        {
        sessionId,
        registerInputs,
        }
    );

    if (!data.success) {
        throw new Error(data.error || "Verification failed");
    }

    return data;
}

// --- Recovery (unchanged, still word-based unless you also migrated this) ---
export async function triggerRecoveryEmail({ email }) {
    const { data } = await sdk.post("/api/sdk/recovery/start", { email });
    if (!data.success) throw new Error(data.error || "Recovery failed");
    return data;
}

// --- NEW: Login via number-box challenge ---
export async function startLoginChallenge({ email }) {
    const { data } = await sdk.post("/api/numbers/login", { email });
    if (!data.success) throw new Error(data.error || "Unable to start login");
    return data;
}

export async function verifyLoginChallenge({ sessionId, registerInputs }) {
    const { data } = await sdk.post("/api/numbers/verify", { sessionId, registerInputs });
    if (!data.success) throw new Error(data.error || "Login verification failed");
    return data;
}