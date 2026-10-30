#!/usr/bin/env node
import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");
if (!existsSync(path.join(output, "index.html"))) {
  throw new Error("Build the game before preparing the submission.");
}

// Keep the playable build, explainer, captions, and project notes together.
for (const entry of ["submission", "docs", "README.md", "LEGAL.md", "RULES_NOTES.md", "SOUND.md", "FIDELITY_AUDIT.md"]) {
  cpSync(path.join(root, entry), path.join(output, entry), { recursive: true });
}
console.log("Submission assets included: dist/submission/explainer.html");
