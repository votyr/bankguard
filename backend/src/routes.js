import visualPasswordController from "./controllers/visualPasswordController.js";
import * as paymentsController from "./controllers/paymentsController.js";

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

// Returns true if it handled the request, false if not an API match
export async function handleApiRequest(req, res) {
  const url = req.url;

  // --- existing Scam2Safe routes (untouched) ---
  if (req.method === "POST" && url.startsWith("/api/") && !url.startsWith("/api/payments")) {
    await visualPasswordController.handle(req, res);
    return true;
  }

  // --- new payments routes ---
  if (req.method === "POST" && url === "/api/payments/create") {
    await runController(req, res, paymentsController.createPayment);
    return true;
  }

  if (req.method === "POST" && url === "/api/payments/confirm") {
    await runController(req, res, paymentsController.confirmPayment);
    return true;
  }

  if (req.method === "GET" && url.startsWith("/api/payments/")) {
    const id = url.split("/").pop();
    try {
      const result = await paymentsController.getPaymentStatusHandler(id);
      send(res, 200, result);
    } catch (err) {
      send(res, err.status || 500, { error: err.message });
    }
    return true;
  }

  return false; // not an API route
}

async function runController(req, res, handlerFn) {
  try {
    const body = await readBody(req);
    const result = await handlerFn(body);
    send(res, 200, result);
  } catch (err) {
    send(res, err.status || 500, { error: err.message });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
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