#!/usr/bin/env node
// CI guard: a PR that changes what ROSA SHIPS must carry a changeset, so a
// version bump can never be silently forgotten — most often a Dependabot
// dependency bump that would otherwise merge and never be released.
//
// What counts as a SHIPPED change:
//   - package source — non-test files under `src/**` (compiled into dist/, which
//     the npm tarball, Docker image and native binaries run);
//   - the abbreviation dictionary — `sap_abbreviation_dictionary.json`;
//   - runtime dependency ranges — dependencies / optionalDependencies /
//     peerDependencies in package.json (they ship in the npm tarball);
//   - the lockfile — any version change in the production closure (the Docker
//     image and the BTP MTA `npm ci` from it), even with no range change;
//   - the Dockerfile — it IS the ghcr.io image, released with the product.
//
// Rule: any shipped change requires a changeset (`.changeset/*.md`, excluding
// README.md). ROSA is a single package, so any changeset covers it.
//
// Escape hatch: a genuinely release-irrelevant shipped change is declared with an
// EMPTY changeset — `npx changeset add --empty` — which passes with a loud note.
//
// Inputs (all optional): argv[2] / $BASE_REF (default origin/main), $HEAD_REF
// (default HEAD).

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { closureChanges, manifestRuntimeChanges } from "./lib/shipped-deps.mjs";

const baseRef = process.argv[2] || process.env.BASE_REF || "origin/main";
const headRef = process.env.HEAD_REF || "HEAD";

const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

function mergeBase(base) {
  try {
    return git("merge-base", base, headRef).trim();
  } catch {
    return base;
  }
}

// `--name-status` so a DELETED changeset (a version PR consuming it) is
// distinguishable from an ADDED one. Rename lines end with the current path.
function diffEntries(base) {
  return git("diff", "--name-status", base, headRef)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      return { status: parts[0][0], path: parts[parts.length - 1] };
    });
}

function jsonAt(base, path) {
  let before = null;
  try {
    before = JSON.parse(git("show", `${base}:${path}`));
  } catch {}
  let after = null;
  try {
    after = JSON.parse(git("show", `${headRef}:${path}`));
  } catch {
    if (headRef === "HEAD" && existsSync(path)) {
      after = JSON.parse(readFileSync(path, "utf8"));
    }
  }
  return [before, after];
}

const isPackageSource = (f) => /^src\/.+/.test(f) && !/\.test\.tsx?$/.test(f);
const isChangeset = (f) =>
  f.startsWith(".changeset/") && f.endsWith(".md") && !f.endsWith("/README.md");

// An empty changeset (`---\n---`) is the sanctioned "no release" opt-out.
function isEmptyChangeset(path) {
  let src;
  try {
    src = existsSync(path) ? readFileSync(path, "utf8") : git("show", `${headRef}:${path}`);
  } catch {
    return false;
  }
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return (m ? m[1].trim() : "") === "";
}

const base = mergeBase(baseRef);
const entries = diffEntries(base);
const changed = new Set(entries.map((e) => e.path));

// ── Collect every shipped change ───────────────────────────────────────────
const findings = [];
for (const f of [...changed].filter(isPackageSource)) findings.push(`source    ${f}`);
if (changed.has("sap_abbreviation_dictionary.json"))
  findings.push("data      sap_abbreviation_dictionary.json (ships in the tarball & binaries)");
if (changed.has("package.json"))
  for (const c of manifestRuntimeChanges(...jsonAt(base, "package.json")))
    findings.push(`range     package.json  ${c}`);
if (changed.has("package-lock.json"))
  for (const c of closureChanges(...jsonAt(base, "package-lock.json"), ""))
    findings.push(`lockfile  runtime closure  ${c}`);
if (changed.has("Dockerfile"))
  findings.push("image     Dockerfile (the ghcr.io image ships with the product)");

const printFindings = (out) => {
  out("  Shipped changes:");
  for (const f of findings) out(`    ${f}`);
};

if (findings.length === 0) {
  console.log(`✓ nothing shipped changed vs ${baseRef} — changeset not required`);
  process.exit(0);
}

// Added changesets are the PR's declared bumps; deleted ones were consumed by
// `changeset version` (the version PR) and no longer exist on disk.
const added = entries.filter((e) => isChangeset(e.path) && e.status !== "D").map((e) => e.path);
const consumed = entries.filter((e) => isChangeset(e.path) && e.status === "D").map((e) => e.path);

// A version PR consumes changesets and touches shipped files only via the
// version mirrors — that's the release itself, no new changeset required.
if (added.length === 0 && consumed.length > 0) {
  console.log(`✓ version PR: ${consumed.length} changeset(s) consumed by \`changeset version\` — no new changeset required`);
  process.exit(0);
}

if (added.length === 0) {
  console.error(`✗ shipped content changed vs ${baseRef} but NO changeset was added.\n`);
  printFindings(console.error);
  console.error("\n  Add one with:  npx changeset");
  console.error("  Not releasing this (yet)? Record it explicitly:  npx changeset add --empty\n");
  process.exit(1);
}

if (added.every(isEmptyChangeset)) {
  console.log(`⚠ shipped content changed and only an EMPTY changeset is present — treating as a deliberate no-release.`);
  printFindings(console.log);
  process.exit(0);
}

console.log(`✓ shipped content changed and a changeset is present.`);
printFindings(console.log);
process.exit(0);
