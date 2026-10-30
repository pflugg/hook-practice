#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// Compare locally held secrets in memory; never print their values.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const secrets = [process.env.OPENAI_API_KEY, process.env.UPSTASH_REDIS_REST_TOKEN, process.env.KV_REST_API_TOKEN].filter((value) => value && value.length > 12);
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const walk = (folder) => readdirSync(folder).flatMap((name) => {
  const target = path.join(folder, name);
  return statSync(target).isDirectory() ? walk(target) : [target];
});
if (existsSync("dist")) files.push(...walk("dist"));
const failures = [];
for (const file of new Set(files)) {
  if (!existsSync(file) || !statSync(file).isFile()) continue;
  const content = readFileSync(file);
  if (secrets.some((secret) => content.includes(Buffer.from(secret))) || /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/.test(content.toString("utf8"))) failures.push(file);
  if (/(^|\/)\.env(?:\.|$)/.test(file) && file !== ".env.example") failures.push(file);
}
if (failures.length) {
  console.error(`Credential check failed in: ${[...new Set(failures)].join(", ")}`);
  process.exitCode = 1;
} else console.log(`Credential check passed: ${new Set(files).size} source/build files; no saved credential values or private environment files found.`);
