#!/usr/bin/env node
/**
 * Helper to run `convex dev` against the shared development deployment.
 * This will overwrite `.env.local` – only use when you intentionally need
 * an isolated Convex sandbox.
 */
import { spawn } from "node:child_process";

const DEV_DEPLOYMENT = "dev:polished-impala-239";

const deployment = process.env.CONVEX_DEPLOYMENT ?? DEV_DEPLOYMENT;
if (deployment !== DEV_DEPLOYMENT) {
  console.warn(
    `[Convex sandbox] CONVEX_DEPLOYMENT is set to "${deployment}". This helper is meant for ${DEV_DEPLOYMENT}.`,
  );
}

console.warn(
  `[Convex sandbox] Starting Convex dev server against "${deployment}". Expect .env.local to be rewritten.`,
);
console.warn("[Convex sandbox] Stop this process when you are done to avoid leaking sandbox credentials.");

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(command, ["convex", "dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    CONVEX_DEPLOYMENT: deployment,
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
