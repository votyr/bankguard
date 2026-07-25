import jwt from "jsonwebtoken";
import { config } from "../config/loadEnv.js"; // adjust path if different
import {
  startTransactionChallenge,
  triggerRecoveryEmail,
  startLoginChallenge,
  verifyLoginChallenge,
} from "../services/VisualPasswordService.js";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 100000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

const routes = {
  "/api/transactions/challenge": startTransactionChallenge,
  "/api/recovery/start": triggerRecoveryEmail,
  "/api/auth/login-start": startLoginChallenge,
};

export default {
  async handle(req, res) {
    console.log("[VPC] url:", JSON.stringify(req.url));
    if (req.url === "/api/auth/login-verify") {
      try {
        const body = await readBody(req);
        const scamResult = await verifyLoginChallenge(body);

        const token = jwt.sign(
          {
            userId: scamResult.user.id,
            email: scamResult.user.email,
            visualPasswordValue: scamResult.visualPasswordValue,
            registerLetters: scamResult.registerLetters,
            pos1: scamResult.pos1,
            pos2: scamResult.pos2,
          },
          config.JWT_SECRET,
          { expiresIn: "12h" }
        );

        return send(res, 200, { success: true, message: scamResult.message, token, user: scamResult.user });

      } catch (error) {
        const status = error.response?.status || error.status || 502;
        const message = error.response?.data?.error || error.message || "Login verification failed";
        return send(res, status, { error: message });
      }
    }

    const handler = routes[req.url];
    if (!handler) {
      return send(res, 404, { error: "Unknown bank integration endpoint" });
    }
    try {
      const body = await readBody(req);
      const result = await handler(body);
      return send(res, 200, result);
    } catch (error) {
      const status = error.response?.status || error.status || 502;
      const message = error.response?.data?.error || error.response?.data?.message || error.message || "Visual Password service unavailable";
      return send(res, status, { error: message });
    }
  },
};