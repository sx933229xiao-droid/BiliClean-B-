#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const distRoot = path.join(projectRoot, "dist");
const requiredFiles = [
  "manifest.json",
  "background/service-worker.js",
  "content/bootstrap.js",
  "content/style.css",
  "popup/index.html",
  "popup/index.css",
  "popup/index.js",
  "options/index.html",
  "options/index.css",
  "options/index.js",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
  "安装说明.md",
  "隐私说明.md"
];

for (const relativePath of requiredFiles) {
  await readFile(path.join(distRoot, relativePath));
}

const manifest = JSON.parse(await readFile(path.join(distRoot, "manifest.json"), "utf8"));
const scriptPaths = [
  manifest.background.service_worker,
  ...manifest.content_scripts.flatMap((entry) => entry.js),
  "popup/index.js",
  "options/index.js"
];

for (const relativePath of scriptPaths) {
  const absolutePath = path.join(distRoot, relativePath);
  const result = spawnSync(process.execPath, ["--check", absolutePath], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  const source = await readFile(absolutePath, "utf8");
  if (/^\s*(?:import|export)\s/mu.test(source)) {
    throw new Error(`${relativePath} 仍含模块语法，不能作为经典内容脚本加载。`);
  }
}

console.log(`Distribution verified: ${requiredFiles.length} required files and ${scriptPaths.length} scripts.`);
