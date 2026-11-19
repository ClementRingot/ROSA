import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("release version sync migrates and updates the npm deployment wrapper", () => {
  const root = mkdtempSync(join(tmpdir(), "rosa-version-test-"));
  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "deploy/btp-npm"), { recursive: true });
    copyFileSync(new URL("./sync-version.js", import.meta.url), join(root, "scripts/sync-version.js"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module", name: "@rosa-mcp/server", version: "9.8.7" }));
    writeFileSync(join(root, "mta.yaml"), "version: 1.0.0\n");
    writeFileSync(join(root, "README.md"), "rosa_1.0.0.mtar\n");
    const wrapperPath = join(root, "deploy/btp-npm/package.json");
    writeFileSync(wrapperPath, JSON.stringify({ engines: { node: ">=22" }, dependencies: { "@clementringot/rosa": "1.12.6", unrelated: "1.0.0" } }));
    const run = () => execFileSync(process.execPath, [join(root, "scripts/sync-version.js")]);
    run();
    const first = readFileSync(wrapperPath, "utf8");
    expect(JSON.parse(first)).toEqual({ engines: { node: ">=22" }, dependencies: { unrelated: "1.0.0", "@rosa-mcp/server": "9.8.7" } });
    run();
    expect(readFileSync(wrapperPath, "utf8")).toBe(first);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
