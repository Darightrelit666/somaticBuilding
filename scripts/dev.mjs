import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

try {
  const esbuildPath = require.resolve("@esbuild/win32-x64/esbuild.exe");
  process.env.ESBUILD_BINARY_PATH = esbuildPath;
} catch {
  // Fallback to whatever the environment already has
}

const viteEntry = require.resolve("vite");
const viteBin = path.resolve(path.dirname(viteEntry), "cli.js");
const args = process.argv.slice(2);

const child = spawn(process.execPath, [viteBin, ...args], {
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code) => process.exit(code ?? 0));
