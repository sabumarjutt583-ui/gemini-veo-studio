// Builds the Electron main + preload entry points with esbuild.
// Run without flags for a one-shot build; with --watch to rebuild on change.
//
// Outputs CommonJS bundles into dist-electron so `main` in package.json
// (dist-electron/main.js) always resolves. better-sqlite3, electron and a
// handful of native/large packages are marked external so they stay out of the
// bundle and are loaded from node_modules at runtime.
import * as esbuild from "esbuild";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const watch = process.argv.includes("--watch");

// Packages that must be externalized: native modules (better-sqlite3,
// @ffmpeg-installer pulls a binary), the electron runtime, and anything that
// resolves to a platform binary. Everything else is bundled.
const EXTERNALS = [
  "electron",
  "better-sqlite3",
  "@ffmpeg-installer/ffmpeg",
  "chokidar",
];

const common = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  sourcemap: watch,
  external: EXTERNALS,
  logLevel: "info",
  // Resolve Node builtins without trying to bundle them.
  mainFields: ["main", "module"],
};

const targets = [
  {
    entryPoints: { main: "electron/main/main.ts" },
    outdir: "dist-electron",
  },
  {
    entryPoints: { preload: "electron/preload/preload.ts" },
    outdir: "dist-electron",
  },
];

function run() {
  return esbuild
    .build({
      ...common,
      entryPoints: targets[0].entryPoints,
      outdir: targets[0].outdir,
    })
    .then(() =>
      esbuild.build({
        ...common,
        entryPoints: targets[1].entryPoints,
        outdir: targets[1].outdir,
      })
    );
}

if (watch) {
  // Watch both entry points in the same process.
  const ctx1 = await esbuild.context({
    ...common,
    entryPoints: targets[0].entryPoints,
    outdir: targets[0].outdir,
  });
  const ctx2 = await esbuild.context({
    ...common,
    entryPoints: targets[1].entryPoints,
    outdir: targets[1].outdir,
  });
  await ctx1.watch();
  await ctx2.watch();
  console.log("[build-electron] watching main + preload (esbuild)");
  const { spawn } = require("node:child_process");
  const electron = require("electron");
  const proc = spawn(electron, [".", "--no-sandbox"], {
    stdio: "inherit",
    shell: false,
  });
  proc.on("exit", () => process.exit(0));
} else {
  await run();
  console.log("[build-electron] main + preload -> dist-electron/");
}
