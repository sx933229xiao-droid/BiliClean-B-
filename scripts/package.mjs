#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const releaseRoot = path.join(projectRoot, "release");
const distRoot = path.join(projectRoot, "dist");
const packageJsonPath = path.join(projectRoot, "package.json");
const manifestPath = path.join(projectRoot, "public/manifest.json");

function escapePowerShellSingleQuote(value) {
  return value.replace(/'/g, "''");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function tryCreateWithZip(distDir, archivePath) {
  const result = spawnSync("zip", ["-qr", archivePath, "."], {
    cwd: distDir,
    encoding: "utf8"
  });
  return result;
}

function tryCreateWithPowerShell(distDir, archivePath) {
  // Use PowerShell Compress-Archive (Windows built-in, zero dependency)
  // Quote paths with single quotes and escape embedded single quotes.
  const distPattern = `${escapePowerShellSingleQuote(distDir)}\\*`;
  const dest = escapePowerShellSingleQuote(archivePath);
  const psCommand = `Compress-Archive -Path '${distPattern}' -DestinationPath '${dest}' -Force`;
  // Prefer powershell.exe (Windows PowerShell 5.1) for maximum compatibility; fallback to pwsh if needed
  const candidates = ["powershell.exe", "powershell", "pwsh"];
  let lastResult = null;
  for (const exe of candidates) {
    const result = spawnSync(exe, ["-NoProfile", "-Command", psCommand], { encoding: "utf8" });
    // If executable not found, spawnSync sets error with code ENOENT
    if (result.error && result.error.code === "ENOENT") {
      lastResult = result;
      continue;
    }
    return result;
  }
  return lastResult;
}

let packageJson;
try {
  packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
} catch (error) {
  console.error(`[package] 读取 ${path.relative(projectRoot, packageJsonPath)} 失败: ${error.message}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  console.error(`[package] 读取 ${path.relative(projectRoot, manifestPath)} 失败: ${error.message}`);
  process.exit(1);
}

const packageVersion = typeof packageJson.version === "string" ? packageJson.version.trim() : "";
const manifestVersion = typeof manifest.version === "string" ? manifest.version.trim() : "";

if (!packageVersion) {
  console.error(`[package] package.json version 缺失或为空`);
  process.exit(1);
}
if (!manifestVersion) {
  console.error(`[package] public/manifest.json version 缺失或为空`);
  process.exit(1);
}
if (packageVersion !== manifestVersion) {
  console.error(`[package] 版本不一致: package.json v${packageVersion} !== public/manifest.json v${manifestVersion}，已中止打包`);
  process.exit(1);
}

const version = packageVersion;
const archivePath = path.join(releaseRoot, `BiliClean-v${version}.zip`);

// Ensure release directory exists before any archive operation
await mkdir(releaseRoot, { recursive: true });
await rm(archivePath, { force: true });

// Validate dist exists (npm run build should have created it)
try {
  await stat(distRoot);
} catch {
  console.error(`[package] dist/ 不存在，请先执行 npm run build`);
  process.exit(1);
}

// Strategy: prefer system zip on non-Windows; on Windows use PowerShell. Always fallback.
// Rationale: zero dependency + Windows compatible. See AGENTS.md §7 and task requirement #9.
// Avoid Node third-party ZIP to keep zero dependency.
let result = null;
let strategy = "";

if (process.platform === "win32") {
  // Windows: PowerShell first
  result = tryCreateWithPowerShell(distRoot, archivePath);
  strategy = "PowerShell Compress-Archive";
  // If PowerShell not found or failed with ENOENT, try zip as fallback
  if (result && result.error && result.error.code === "ENOENT") {
    const zipFallback = tryCreateWithZip(distRoot, archivePath);
    if (!zipFallback.error || zipFallback.error.code !== "ENOENT") {
      result = zipFallback;
      strategy = "zip (fallback)";
    }
  }
} else {
  // Unix-like: try zip first
  result = tryCreateWithZip(distRoot, archivePath);
  strategy = "zip";
  if (result && result.error && result.error.code === "ENOENT") {
    // zip not available, fallback to PowerShell if present (e.g., pwsh on macOS/Linux)
    const psFallback = tryCreateWithPowerShell(distRoot, archivePath);
    if (psFallback && (!psFallback.error || psFallback.error.code !== "ENOENT")) {
      result = psFallback;
      strategy = "PowerShell Compress-Archive (fallback)";
    }
  }
}

if (!result) {
  console.error(`[package] 未能创建 ZIP：无可用打包工具 (zip / PowerShell)`);
  process.exit(1);
}
if (result.error) {
  console.error(`[package] 打包工具执行失败 [${strategy}]: ${result.error.message}`);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.stdout) process.stdout.write(result.stdout);
  process.exit(1);
}
if (result.status !== 0) {
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.stdout) process.stdout.write(result.stdout);
  console.error(`[package] 打包失败 [${strategy}] exit code ${result.status}`);
  process.exit(result.status ?? 1);
}

const archiveBuffer = await readFile(archivePath);
const digest = createHash("sha256").update(archiveBuffer).digest("hex");
const fileStat = await stat(archivePath);
const relativeArchive = path.relative(projectRoot, archivePath);

console.log(`${relativeArchive}`);
console.log(`Size ${fileStat.size} bytes (${formatBytes(fileStat.size)})`);
console.log(`SHA-256 ${digest}`);
console.log(`Version ${version}`);
console.log(`Strategy ${strategy}`);
