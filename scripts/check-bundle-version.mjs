#!/usr/bin/env node
// Assert that a built bundle reports the REAL package version over MCP.
//
// Drives a stdio MCP `initialize` handshake against the bundle and checks that
// serverInfo.version === package.json version. This replaces the old CI step
// (`timeout 3 node bundle/index.cjs || true`) that could never fail, and it
// catches the class of bug where the bundle/binaries shipped a stale version
// because the esbuild version `define` was missing.
//
// Usage: node scripts/check-bundle-version.mjs [path/to/bundle.cjs]
//        (defaults to bundle/index.cjs)

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundlePath = process.argv[2] || join(root, "bundle", "index.cjs");
const expected = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8")
).version;

const initialize =
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "check-bundle-version", version: "1.0.0" },
    },
  }) + "\n";

function handshake() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [bundlePath], {
      stdio: ["pipe", "pipe", "inherit"],
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("timed out waiting for the initialize response"));
    }, 15000);

    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
      for (const line of out.split("\n")) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === 1 && msg.result) {
            clearTimeout(timer);
            child.kill("SIGKILL");
            resolve(msg.result);
            return;
          }
        } catch {
          // partial line, keep buffering
        }
      }
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`process exited (code ${code}) before responding`));
    });
    child.stdin.write(initialize);
  });
}

const result = await handshake();
const actual = result?.serverInfo?.version;
console.log(`bundle: ${bundlePath}`);
console.log(`serverInfo.version = ${actual}  (expected ${expected})`);

if (actual !== expected) {
  console.error(
    `::error::bundle version mismatch: got "${actual}", expected "${expected}". ` +
      `Is the esbuild __ROSA_VERSION__ define present (see esbuild.config.mjs)?`
  );
  process.exit(1);
}
console.log("✓ bundle reports the real package version");
