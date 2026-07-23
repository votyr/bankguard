import {
  startTransactionChallenge,
  verifyTransactionChallenge,
  triggerRecoveryEmail,
  startLoginChallenge,
  verifyLoginChallenge,
} from "../services/VisualPasswordService.js";
import { getAuthedEmail } from "../services/requireAuth.js";

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
  "/api/transactions/verify": verifyTransactionChallenge,
  "/api/recovery/start": triggerRecoveryEmail,
  "/api/auth/login-start": startLoginChallenge,
  "/api/auth/login-verify": verifyLoginChallenge,
};

export default {
  async handle(req, res) {
    const handler = routes[req.url];

    if (!handler) {
      return send(res, 404, {
        error: "Unknown bank integration endpoint",
      });
    }

    try {
      const body = await readBody(req);
      const result = await handler(body);
      return send(res, 200, result);
    } catch (error) {
      const status =
        error.response?.status ||
        error.status ||
        502;

      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Visual Password service unavailable";

      return send(res, status, { error: message });
    }
  },
};