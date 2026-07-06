#!/usr/bin/env node

// ============================================================================
// sync-version.js — propagate the package.json version to every other file
// that hard-codes it, so a single `npm version` (or a release-train bump)
// keeps the whole repo consistent. Idempotent: safe to run any time.
//
// Sources of drift kept in sync:
//   - mta.yaml            : `version:` descriptor field
//   - README.md           : `..._X.Y.Z.mtar` archive references
//   - src/index.ts        : the compiled-in fallback version literal
//
// Wired to the npm `version` lifecycle hook in package.json so bumps stay
// automatic; also runnable on demand via `npm run sync-version`.
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const version = pkg.version;

if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`[sync-version] invalid version in package.json: ${version}`);
  process.exit(1);
}

/**
 * Apply a regex replacement to a file relative to the repo root and report
 * whether anything changed. Missing files are skipped (not an error) so the
 * script is robust to files being renamed or removed.
 */
function patch(relPath, pattern, replacement) {
  const abs = join(root, relPath);
  let before;
  try {
    before = readFileSync(abs, "utf-8");
  } catch {
    console.log(`[sync-version] skip (not found): ${relPath}`);
    return;
  }
  const after = before.replace(pattern, replacement);
  if (after !== before) {
    writeFileSync(abs, after);
    console.log(`[sync-version] updated ${relPath} -> ${version}`);
  } else {
    console.log(`[sync-version] ${relPath} already at ${version}`);
  }
}

// mta.yaml — top-level `version:` field (preserve any trailing comment, e.g.
// the release-please `# x-release-please-version` annotation)
patch("mta.yaml", /^(version:\s*)\d+\.\d+\.\d+/m, `$1${version}`);

// README.md — every `_X.Y.Z.mtar` reference (e.g. mta_archives/rosa_1.2.3.mtar)
patch("README.md", /_\d+\.\d+\.\d+\.mtar/g, `_${version}.mtar`);

// src/index.ts — the compiled-in fallback version literal
patch(
  "src/index.ts",
  /(let version = ")\d+\.\d+\.\d+(";)/,
  `$1${version}$2`
);

console.log(`[sync-version] done (version ${version})`);
