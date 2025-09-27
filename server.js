// Minimal HTTP server (no Express). Live on Render.
// Endpoints: GET /health, POST /echo, POST /chat (BYOK proxy to OpenAI)

const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 8080;
const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "*";

function setCors(res) {
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
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

// Helper: call OpenAI chat completions using the user's key (BYOK)
async function callOpenAIChat({ userKey, model, messages, temperature = 0.7, max_tokens = 512 }) {
  // Node 18+ has global fetch on Render
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userKey}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages,
      temperature,
      max_tokens,
    }),
  });

  // Do not leak secrets or full payloads in errors
  if (!resp.ok) {
    let err = { status: resp.status, error: "Upstream error" };
    try {
      const j = await resp.json();
      // Return only safe bits
      err = { status: resp.status, error: j.error?.message || "Upstream error" };
    } catch (_) {}
    throw err;
  }

  const data = await resp.json();
  const choice = data.choices?.[0];
  const text = choice?.message?.content ?? "";
  const usage = data.usage || {};
  const usedModel = data.model || model;

  return { text, usage, model: usedModel };
}

const server = http.createServer(async (req, res) => {
  setCors(res);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = (req.method || "GET").toUpperCase();

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
      // BYOK: expect Authorization: Bearer <user_api_key>
      const auth = req.headers["authorization"] || "";
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (!m) return send(res, 401, { error: "Missing Authorization Bearer token" });
      const userKey = m[1].trim();
      if (!userKey) return send(res, 401, { error: "Invalid API key" });

      const body = await readJson(req);
      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (messages.length === 0) return send(res, 400, { error: "messages[] required" });

      // Optional params
      const model = body.model || "gpt-4o-mini";
      const temperature = typeof body.temperature === "number" ? body.temperature : 0.7;
      const max_tokens = typeof body.max_tokens === "number" ? body.max_tokens : 512;

      // Guardrails: crude size cap to avoid abuse
      if (messages.length > 40) return send(res, 413, { error: "Too many messages" });

      // Call provider
      const result = await callOpenAIChat({ userKey, model, messages, temperature, max_tokens });

      return send(res, 200, result); // { text, usage, model }
    }

    return send(res, 404, { error: "Not found" });
  } catch (err) {
    // Never include Authorization or request body here
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
    return send(res, status, { error: err?.error || err?.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
