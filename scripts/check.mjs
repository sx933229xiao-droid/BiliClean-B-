#!/usr/bin/env node

import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = path.join(projectRoot, "src");

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(absolutePath) : [absolutePath];
  }));
  return nested.flat();
}

const JavaScriptFiles = (await filesBelow(projectRoot)).filter((file) =>
  file.endsWith(".js") || file.endsWith(".mjs")
).filter((file) => !file.includes(`${path.sep}dist${path.sep}`));

for (const file of JavaScriptFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
}

const sourceFiles = JavaScriptFiles.filter((file) => file.startsWith(sourceRoot));
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/^import .* from "(.+)";/gmu)) {
    const importedPath = path.resolve(path.dirname(file), match[1]);
    await access(importedPath).catch(() => {
      throw new Error(`${path.relative(projectRoot, file)} 引用了不存在的模块 ${match[1]}`);
    });
  }
}

const sideEffectEntries = new Set([
  path.join(sourceRoot, "background/service-worker.js"),
  path.join(sourceRoot, "content/bootstrap.js"),
  path.join(sourceRoot, "popup/index.js"),
  path.join(sourceRoot, "options/index.js")
]);
for (const file of sourceFiles.filter((candidate) => !sideEffectEntries.has(candidate))) {
  await import(pathToFileURL(file));
}

const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(projectRoot, "public/manifest.json"), "utf8"));

if (manifest.manifest_version !== 3 || manifest.version !== packageJson.version) {
  throw new Error("package.json 与 manifest.json 的版本或 MV3 配置不一致。");
}
if (JSON.stringify(manifest.permissions) !== JSON.stringify(["storage"])) {
  throw new Error("权限基线已改变；v0.1.4 只应申请 storage 权限。");
}
if (!manifest.host_permissions?.includes("*://*.bilibili.com/*")) {
  throw new Error("缺少 B 站 host_permissions。 ");
}

console.log(`Check passed: ${JavaScriptFiles.length} scripts, ${sourceFiles.length} source modules, ${sourceFiles.length - sideEffectEntries.size} import smoke tests.`);
