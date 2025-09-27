// Minimal HTTP server for Render — no external deps.
// Endpoints: GET /health, POST /echo, (placeholder) POST /chat
// CORS is restricted by CORS_ORIGIN env var.

const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 8080;
const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "*";

function setCors(res, origin) {
  // Allow exact origin or the configured one
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCors(res, req.headers.origin || "");
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method.toUpperCase();

  // Preflight
  if (method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (method === "GET" && path === "/health") {
      return send(res, 200, { ok: true, ts: Date.now() });
    }

    if (method === "POST" && path === "/echo") {
      const body = await readJson(req);
      return send(res, 200, { reply: String(body.message || "") });
    }

    if (method === "POST" && path === "/chat") {
      // Placeholder until we wire the real AI proxy.
      // Keeps Render "green" and lets the frontend hit the route safely.
      return send(res, 501, { error: "Chat proxy not implemented yet" });
    }

    // Fallback 404
    return send(res, 404, { error: "Not found" });
  } catch (err) {
    return send(res, 400, { error: err.message || "Bad request" });
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});


