// server.js — full, production-safe, Render-ready
// CommonJS style to match your current code base

const express = require("express");
const path = require("path");
const cors = require("cors");
const morgan = require("morgan");
const OpenAI = require("openai"); // v4 SDK supports `new OpenAI({ apiKey })`

// ----- Config -----
const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Allow your site origins here (add your Vercel/Render frontend URL)
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://your-frontend-on-vercel.vercel.app",
  "https://your-frontend-on-render.onrender.com"
].filter(Boolean);

// ----- Middleware -----
app.use(morgan("tiny"));
app.use(express.json({ limit: "1mb" }));     // parse JSON
app.use(express.urlencoded({ extended: false }));
app.use(cors({
  origin(origin, cb) {
    // allow same-origin / curl / server-to-server
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS: Origin not allowed"), false);
  },
  credentials: true
}));

// Serve static assets from repo root (index.html, app.js, app.css)
app.use(express.static(path.join(__dirname)));

// ----- Health / Echo -----
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.post("/echo", (req, res) => {
  const msg = String(req.body?.message ?? "");
  res.json({ reply: msg });
});

// ----- OpenAI Client -----
const client = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// Small helper to enforce timeouts on async calls
function withTimeout(promise, ms = 20000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Request timed out")), ms);
    promise.then(v => { clearTimeout(t); resolve(v); })
           .catch(e => { clearTimeout(t); reject(e); });
  });
}

// ----- Chat Route (keeps your “extra” functionality) -----
// POST /chat { message: string, system?: string, model?: string }
app.post("/chat", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY not set on server" });
    }

    const userMessage = String(req.body?.message ?? "").trim();
    const systemPrompt = String(req.body?.system ?? "You are a helpful assistant.");
    const model = String(req.body?.model ?? "gpt-5-mini");

    if (!userMessage) {
      return res.status(400).json({ error: "Missing 'message' in request body" });
    }

    // Call OpenAI (non-streaming for simplicity & reliability on Render)
    const completion = await withTimeout(
      client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.2,
        max_tokens: 600
      }),
      25000
    );

    const reply = completion?.choices?.[0]?.message?.content ?? "";
    res.json({
      ok: true,
      model,
      reply
    });
  } catch (err) {
    console.error("CHAT ERROR:", err);
    const status = err?.status ?? 500;
    res.status(status).json({
      ok: false,
      error: err?.message || "Server error",
    });
  }
});

// ----- SPA Fallback (keeps client-side routing working) -----
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ----- Boot -----
app.listen(PORT, () => {
  console.log(`Nodea server listening on ${PORT}`);
});
