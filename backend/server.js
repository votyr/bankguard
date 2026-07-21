import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApiRequest } from "./src/routes.js";
import { connectDB } from "./src/config/db.js";
import { config } from "./src/config/loadEnv.js";
import visualPasswordController from "./src/controllers/visualPasswordController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function send(res, status, body) {
    res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
    });

    res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
    const publicRoot = path.join(__dirname, "public");

    const fullPath = path.resolve(
        __dirname,
        req.url === "/"
            ? "public/index.html"
            : `public${decodeURIComponent(req.url)}`
    );

    console.log(req.method, req.url);
    if (!fullPath.startsWith(publicRoot) || !fs.existsSync(fullPath)) {
        return send(res, 404, { error: "Not found" });
    }

    const type = fullPath.endsWith(".css")
        ? "text/css"
        : fullPath.endsWith(".js")
        ? "application/javascript"
        : "text/html";

    res.writeHead(200, {
        "content-type": `${type}; charset=utf-8`,
    });

    fs.createReadStream(fullPath).pipe(res);
}

const server = http.createServer(async (req, res) => {
    // Allow Vite dev server
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Handle preflight
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }

    console.log(req.method, req.url);

    if (req.url.startsWith("/api/")) {
        const handled = await handleApiRequest(req, res);
        if (handled) return;
        return send(res, 404, { error: "Unknown API route" });
    }
    if (req.method === "GET") {
        return serveStatic(req, res);
    }

    return send(res, 405, { error: "Method not allowed" });
});

const port = Number(config.PORT || 3001);

connectDB().then(() => {
    server.listen(port, () => {
        console.log(`Bank integration demo at http://localhost:${port}`);
    });
});

export { server };