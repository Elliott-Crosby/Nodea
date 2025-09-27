// Minimal HTTP server (no Express)
const http = require("http");
const { URL } = require("url");

const PORT = process.env.PORT || 8080;

// Allow multiple origins (production + preview + localhost)
const ALLOW_LIST = [
  process.env.CORS_ORIGIN || "",                         // your primary prod domain
  "https://nodea-seven.vercel.app",                      // prod alias (keep if you use it)
  "https://nodea-git-main-elliott-crosbys-projects.vercel.app", // git-main preview
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
].filter(Boolean);

function setCors(res, origin) {
  const allowed = ALLOW_LIST.some(o => o === origin);
  res.setHeader("Access-Control-Allow-Origin", allowed ? origin : ALLOW_LIST[0] || "*");
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
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

async function callOpenAIChat({ userKey, model, messages, temperature = 0.7, max_tokens = 512 }) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${userKey}` },
    body: JSON.stringify({ model: model || "gpt-4o-mini", messages, temperature, max_tokens }),
  });
  if (!resp.ok) {
    let err = { status: resp.status, error: "Upstream error" };
    try { const j = await resp.json(); err = { status: resp.status, error: j.error?.message || "Upstream error" }; } catch {}
    throw err;
  }
  const data = await resp.json();
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    usage: data.usage || {},
    model: data.model || model
  };
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  setCors(res, origin);

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = (req.method || "GET").toUpperCase();

  if (method === "OPTIONS") { res.statusCode = 204; return res.end(); }

  try {
    if (method === "GET" && path === "/health") return send(res, 200, { ok: true, ts: Date.now() });
    if (method === "POST" && path === "/echo")  { const b = await readJson(req); return send(res, 200, { reply: String(b.message || "") }); }

    if (method === "POST" && path === "/chat") {
      const auth = req.headers.authorization || "";
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (!m) return send(res, 401, { error: "Missing Authorization Bearer token" });
      const userKey = m[1].trim();
      if (!userKey) return send(res, 401, { error: "Invalid API key" });

      const body = await readJson(req);
      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (messages.length === 0) return send(res, 400, { error: "messages[] required" });

      const result = await callOpenAIChat({
        userKey,
        model: body.model || "gpt-4o-mini",
        messages,
        temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
        max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : 512
      });
      return send(res, 200, result);
    }

    return send(res, 404, { error: "Not found" });
  } catch (err) {
    const status = (err && Number.isInteger(err.status)) ? err.status : 500;
    return send(res, status, { error: err?.error || err?.message || "Server error" });
  }
});

server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
