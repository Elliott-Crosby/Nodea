import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    // Generated dirs at any depth — nested checkouts/worktrees carry their own.
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "next-env.d.ts",
    // Claude Code worktrees are full repo copies — don't lint their sources either.
    ".claude/**",
    // Standalone extension repo checkout (gitignored, lints in its own repo).
    "extension/**",
  ]),
]);

export default eslintConfig;
