import { describe, it, expect } from "vitest";
import {
  closureChanges,
  manifestRuntimeChanges,
  runtimeClosure,
} from "./shipped-deps.mjs";

// A minimal lockfile v3 shaped like ROSA's: a single root package "" with
// runtime and dev deps, a nested (non-hoisted) copy, and a peer dep.
function lockfile(overrides = {}) {
  const lock = {
    lockfileVersion: 3,
    packages: {
      "": {
        name: "@rosa-mcp/server",
        version: "1.14.0",
        dependencies: { express: "^5.2.1", zod: "^3.25.0" },
        devDependencies: { typescript: "^5.7.0", vitest: "^3.2.4" },
      },
      "node_modules/express": {
        version: "5.2.1",
        dependencies: { "body-parser": "^2.2.0", debug: "^4.4.0" },
        peerDependencies: { "peer-thing": "^1.0.0" },
      },
      "node_modules/express/node_modules/debug": { version: "4.4.3" },
      "node_modules/debug": { version: "3.2.7", dev: true },
      "node_modules/body-parser": { version: "2.2.0" },
      "node_modules/peer-thing": { version: "1.0.0" },
      "node_modules/zod": { version: "3.25.0" },
      "node_modules/typescript": { version: "5.7.0", dev: true },
      "node_modules/vitest": { version: "3.2.4", dev: true },
    },
  };
  Object.assign(lock.packages, overrides);
  return lock;
}

describe("runtimeClosure (root package, key '')", () => {
  const closure = runtimeClosure(lockfile(), "");

  it("resolves the root package's runtime + peer deps, transitively", () => {
    expect([...closure.keys()].sort()).toEqual([
      "node_modules/body-parser",
      "node_modules/express",
      "node_modules/express/node_modules/debug",
      "node_modules/peer-thing",
      "node_modules/zod",
    ]);
  });

  it("resolves the nearest nested copy, like Node does", () => {
    expect(closure.get("node_modules/express/node_modules/debug")).toBe("4.4.3");
    expect(closure.has("node_modules/debug")).toBe(false);
  });

  it("never follows devDependencies", () => {
    expect(closure.has("node_modules/typescript")).toBe(false);
    expect(closure.has("node_modules/vitest")).toBe(false);
  });

  it("is empty for an unknown root path", () => {
    expect(runtimeClosure(lockfile(), "packages/nope").size).toBe(0);
  });
});

describe("closureChanges (root package, key '')", () => {
  it("flags a transitive-only bump (the npm audit fix case)", () => {
    const head = lockfile({ "node_modules/body-parser": { version: "2.2.1" } });
    expect(closureChanges(lockfile(), head, "")).toEqual([
      "body-parser: 2.2.0 → 2.2.1",
    ]);
  });

  it("ignores a dev-only bump", () => {
    const head = lockfile({
      "node_modules/typescript": { version: "5.8.0", dev: true },
    });
    expect(closureChanges(lockfile(), head, "")).toEqual([]);
  });

  it("ignores the root package's own version bump (a release PR)", () => {
    const head = lockfile();
    head.packages[""] = { ...head.packages[""], version: "1.14.1" };
    expect(closureChanges(lockfile(), head, "")).toEqual([]);
  });

  it("reports added and removed packages", () => {
    const head = lockfile({
      "node_modules/express": {
        version: "5.3.0",
        dependencies: { "body-parser": "^2.2.0", qs: "^6.0.0" },
      },
      "node_modules/qs": { version: "6.14.0" },
    });
    expect(closureChanges(lockfile(), head, "")).toEqual([
      "debug: 4.4.3 → (removed)",
      "express: 5.2.1 → 5.3.0",
      "peer-thing: 1.0.0 → (removed)",
      "qs: (none) → 6.14.0",
    ]);
  });

  it("ignores npm re-hoisting a package at the same version", () => {
    const head = lockfile({ "node_modules/debug": { version: "4.4.3" } });
    delete head.packages["node_modules/express/node_modules/debug"];
    expect(closureChanges(lockfile(), head, "")).toEqual([]);
  });

  it("lists every version of a package installed at several", () => {
    const head = lockfile({
      "node_modules/zod": { version: "3.25.1" },
      "node_modules/body-parser": {
        version: "2.2.0",
        dependencies: { zod: "^4.0.0" },
      },
      "node_modules/body-parser/node_modules/zod": { version: "4.0.5" },
    });
    expect(closureChanges(lockfile(), head, "")).toEqual([
      "zod: 3.25.0 → 3.25.1, 4.0.5",
    ]);
  });
});

describe("manifestRuntimeChanges", () => {
  it("reports runtime range changes and ignores devDependencies", () => {
    const base = {
      dependencies: { zod: "^3.25.0" },
      devDependencies: { vitest: "^3.0.0" },
    };
    const head = {
      dependencies: { zod: "^3.26.0" },
      devDependencies: { vitest: "^4.1.9" },
    };
    expect(manifestRuntimeChanges(base, head)).toEqual([
      "dependencies.zod: ^3.25.0 → ^3.26.0",
    ]);
  });

  it("covers optionalDependencies and peerDependencies", () => {
    const base = { peerDependencies: { "peer-thing": ">=1.0.0" } };
    const head = { peerDependencies: { "peer-thing": ">=2.0.0" } };
    expect(manifestRuntimeChanges(base, head)).toEqual([
      "peerDependencies.peer-thing: >=1.0.0 → >=2.0.0",
    ]);
  });

  it("ignores a version-field-only change", () => {
    expect(
      manifestRuntimeChanges({ version: "1.14.0" }, { version: "1.14.1" })
    ).toEqual([]);
  });

  it("handles an absent manifest on either side", () => {
    expect(manifestRuntimeChanges(null, { dependencies: { a: "1" } })).toEqual([
      "dependencies.a: (none) → 1",
    ]);
  });
});
