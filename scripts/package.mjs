#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const releaseRoot = path.join(projectRoot, "release");
const archivePath = path.join(releaseRoot, "BiliClean-v0.1.4-install.zip");

await mkdir(releaseRoot, { recursive: true });
await rm(archivePath, { force: true });

const result = spawnSync("zip", ["-qr", archivePath, "."], {
  cwd: path.join(projectRoot, "dist"),
  encoding: "utf8"
});
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

const digest = createHash("sha256").update(await readFile(archivePath)).digest("hex");
console.log(`${path.relative(projectRoot, archivePath)}\nSHA-256 ${digest}`);
