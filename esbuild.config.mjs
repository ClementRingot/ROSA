// Bundle the compiled server (dist/index.js) into a single CJS file for
// @yao-pkg/pkg to turn into native executables.
//
// The package version is baked in here via `define` as __ROSA_VERSION__, so the
// bundle — and therefore the native binaries — report the real version. Inside
// a bundle `require('../package.json')` is not resolvable, which is why the
// unbundled fallback in src/index.ts alone reported a stale version for the
// binaries. See src/index.ts resolveVersion().
import { readFileSync, copyFileSync } from "node:fs";
import { build } from "esbuild";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
);

await build({
  entryPoints: ["dist/index.js"],
  outfile: "bundle/index.cjs",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  define: { __ROSA_VERSION__: JSON.stringify(version) },
});

// pkg reads the dictionary as an asset from next to the bundle at build time.
copyFileSync(
  "sap_abbreviation_dictionary.json",
  "bundle/sap_abbreviation_dictionary.json"
);

console.log(`[esbuild] bundled bundle/index.cjs with version ${version}`);
