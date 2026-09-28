#!/usr/bin/env node
// The `publish-script` of .github/workflows/changesets.yml — runs on a push to
// main that has NO pending changesets (i.e. right after the "version packages"
// PR merges, when the committed version IS the release).
//
// It creates and pushes the canonical vX.Y.Z tag for the committed
// package.json version if it isn't already on origin. The pushed tag then
// triggers release.yml (npm + GHCR + binaries). NOTE: for that trigger to
// fire, the tag must be pushed with the release GitHub App's token (see the
// workflow) — tags pushed with the default GITHUB_TOKEN do not trigger
// workflows (GitHub's recursive-workflow prevention).
//
// Idempotent: an existing tag is skipped, so re-runs and changeset-less merges
// (docs/CI only) are no-ops. There is no dry-run — running it locally on a
// clean tree WILL push a tag; it is meant to run only from the workflow.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

const { version } = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8")
);
const tag = `v${version}`;

if (git("ls-remote", "--tags", "origin", `refs/tags/${tag}`) !== "") {
  console.log(`✓ ${tag} already on origin — nothing to do`);
  process.exit(0);
}

console.log(`• tagging ${tag}…`);
git("tag", "-a", tag, "-m", tag);
execFileSync("git", ["push", "origin", tag], { cwd: root, stdio: "inherit" });
console.log(`✓ pushed ${tag} (release.yml will now build the artifacts)`);
