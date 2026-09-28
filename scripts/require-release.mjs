#!/usr/bin/env node
// CI guard: a PR that changes what ROSA SHIPS must carry a release-triggering
// conventional commit, so a change (typically a Dependabot dependency bump)
// can never be merged and then silently left unreleased.
//
// This is the release-please equivalent of LISA's changeset guard. release-please
// only cuts a release for commits of type `feat` (minor), `fix` (patch), or a
// breaking change (`!` / `BREAKING CHANGE`, major). `chore`, `docs`, `ci`, etc.
// do NOT release — so a `chore(deps)` dependency bump would ship in the next
// release only by accident. (Which is why Dependabot is configured to prefix
// production bumps `fix(deps)`; this guard is the backstop.)
//
// What counts as a SHIPPED change:
//   - package source — non-test files under `src/**` (compiled into dist/, which
//     is what the npm tarball, Docker image and native binaries run);
//   - the abbreviation dictionary — `sap_abbreviation_dictionary.json` ships in
//     the tarball and is embedded in the binaries;
//   - runtime dependency ranges — dependencies / optionalDependencies /
//     peerDependencies in package.json (they ship in the npm tarball);
//   - the lockfile — any version change in the production closure (the Docker
//     image and the BTP MTA `npm ci` from it), even with no range change;
//   - the Dockerfile — it IS the ghcr.io image, released with the product.
//
// Rule: if anything shipped changed, at least one commit in the PR (or the PR
// title, for squash merges) must be releasable — unless the PR carries the
// `no-release` label (the explicit escape hatch, LISA's empty changeset).
//
// Inputs (all optional):
//   argv[2] / $BASE_REF   base ref to diff against         (default origin/main)
//   $HEAD_REF             head ref                          (default HEAD)
//   $PR_TITLE             PR title (checked for squash merges)
//   $PR_LABELS            comma-separated PR label names (for `no-release`)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { closureChanges, manifestRuntimeChanges } from "./lib/shipped-deps.mjs";

const baseRef = process.argv[2] || process.env.BASE_REF || "origin/main";
const headRef = process.env.HEAD_REF || "HEAD";
const prTitle = process.env.PR_TITLE || "";
const prLabels = (process.env.PR_LABELS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const RELEASE_LABEL = "no-release";

const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

// The commit the PR branched from; falls back to the base ref itself for
// shallow checkouts where the merge-base is unavailable.
function mergeBase(base) {
  try {
    return git("merge-base", base, headRef).trim();
  } catch {
    return base;
  }
}

// `--name-status` so a deletion is distinguishable; last field is current path.
function diffPaths(base) {
  return git("diff", "--name-status", base, headRef)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      return parts[parts.length - 1];
    });
}

// A JSON file as of the base commit and as of head (null when absent).
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

// release-please releasable types: feat/fix, or any type marked breaking
// (`type!:` / `scope!:`), or a `BREAKING CHANGE:` footer.
const RELEASABLE_TYPES = new Set(["feat", "fix"]);

function isReleasable(subject, body) {
  const m = subject.match(/^(\w+)(?:\([^)]*\))?(!)?:/);
  if (m) {
    if (m[2]) return true; // `!` = breaking change → major
    if (RELEASABLE_TYPES.has(m[1])) return true;
  }
  if (/(^|\n)BREAKING[ -]CHANGE:/.test(body)) return true;
  return false;
}

// Commit subjects+bodies in base..head.
function releasableCommitFound(base) {
  let log;
  try {
    log = git("log", "--format=%s%x00%b%x1e", `${base}..${headRef}`);
  } catch {
    return false;
  }
  return log
    .split("\x1e")
    .map((rec) => rec.split("\x00"))
    .some(([subject = "", body = ""]) => isReleasable(subject.trim(), body));
}

const isPackageSource = (f) => /^src\/.+/.test(f) && !/\.test\.tsx?$/.test(f);

const base = mergeBase(baseRef);
const changed = new Set(diffPaths(base));

// ── Collect every shipped change ───────────────────────────────────────────
const findings = [];

for (const f of [...changed].filter(isPackageSource)) {
  findings.push(`source    ${f}`);
}
if (changed.has("sap_abbreviation_dictionary.json")) {
  findings.push("data      sap_abbreviation_dictionary.json (ships in the tarball & binaries)");
}
if (changed.has("package.json")) {
  for (const change of manifestRuntimeChanges(...jsonAt(base, "package.json"))) {
    findings.push(`range     package.json  ${change}`);
  }
}
if (changed.has("package-lock.json")) {
  for (const change of closureChanges(...jsonAt(base, "package-lock.json"), "")) {
    findings.push(`lockfile  runtime closure  ${change}`);
  }
}
if (changed.has("Dockerfile")) {
  findings.push("image     Dockerfile (the ghcr.io image ships with the product)");
}

const printFindings = (out) => {
  out("  Shipped changes:");
  for (const f of findings) out(`    ${f}`);
};

if (findings.length === 0) {
  console.log(`✓ nothing shipped changed vs ${baseRef} — release not required`);
  process.exit(0);
}

// Escape hatch — an explicit "not releasing this" decision.
if (prLabels.includes(RELEASE_LABEL)) {
  console.log(
    `⚠ shipped content changed but the "${RELEASE_LABEL}" label is set — treating as a deliberate no-release.`
  );
  printFindings(console.log);
  process.exit(0);
}

// A releasable commit (or PR title, for squash merges) must be present.
const titleReleasable = prTitle && isReleasable(prTitle, "");
if (releasableCommitFound(base) || titleReleasable) {
  console.log(
    `✓ shipped content changed and a releasable commit is present (feat/fix/breaking).`
  );
  printFindings(console.log);
  process.exit(0);
}

console.error(`✗ shipped content changed vs ${baseRef} but NO releasable commit is present.\n`);
printFindings(console.error);
console.error(
  "\n  release-please only releases feat / fix / breaking (! or BREAKING CHANGE)." +
    "\n  Either use one of those commit types (e.g. `fix(deps): …` for a dependency bump)," +
    `\n  or, if this genuinely should not be released, add the "${RELEASE_LABEL}" label.\n`
);
process.exit(1);
