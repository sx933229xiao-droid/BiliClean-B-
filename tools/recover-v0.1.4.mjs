#!/usr/bin/env node

/**
 * Reconstructs the module files that are still delimited by esbuild source
 * comments in the published BiliClean v0.1.4 JavaScript bundles.
 *
 * Usage:
 *   node recovery/recover-source.mjs <install-directory> <output-directory>
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [, , installDirectory, outputDirectory] = process.argv;

if (!installDirectory || !outputDirectory) {
  throw new Error("请提供安装包解压目录和源码输出目录。");
}

async function splitBundle(relativePath) {
  const absolutePath = path.join(installDirectory, relativePath);
  const bundle = await readFile(absolutePath, "utf8");
  const marker = /^\s*\/\/ (src\/[^\n]+)\n/gmu;
  const matches = [...bundle.matchAll(marker)];
  const modules = new Map();

  for (const [index, match] of matches.entries()) {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? bundle.length;
    const bundledBody = bundle.slice(start, end);
    const firstContentLine = bundledBody.match(/^[ \t]*\S.*$/mu)?.[0] ?? "";
    const dedentedBody = firstContentLine.startsWith("  ")
      ? bundledBody.replace(/^  /gmu, "")
      : bundledBody;
    const body = dedentedBody.replace(/\n\}\)\(\);\s*$/u, "").trimEnd();
    modules.set(match[1], body);
  }

  return modules;
}

const [background, content, popup, options] = await Promise.all([
  splitBundle("background/service-worker.js"),
  splitBundle("content/bootstrap.js"),
  splitBundle("popup/index.js"),
  splitBundle("options/index.js")
]);

const selected = new Map([
  ["src/shared/defaults.ts", content.get("src/shared/defaults.ts")],
  ["src/shared/messages.ts", background.get("src/shared/messages.ts")],
  ["src/shared/validation.ts", background.get("src/shared/validation.ts")],
  ["src/shared/client.ts", popup.get("src/shared/client.ts")],
  ["src/storage/settings-repository.ts", background.get("src/storage/settings-repository.ts")],
  ["src/background/service-worker.ts", background.get("src/background/service-worker.ts")],
  ["src/content/adapters/selectors.ts", content.get("src/content/adapters/selectors.ts")],
  ["src/content/core/normalizer.ts", content.get("src/content/core/normalizer.ts")],
  ["src/content/core/heuristics.ts", content.get("src/content/core/heuristics.ts")],
  ["src/content/core/rule-engine.ts", content.get("src/content/core/rule-engine.ts")],
  ["src/content/adapters/dom-utils.ts", content.get("src/content/adapters/dom-utils.ts")],
  ["src/content/adapters/base-adapter.ts", content.get("src/content/adapters/base-adapter.ts")],
  ["src/content/adapters/entity-parsers.ts", content.get("src/content/adapters/entity-parsers.ts")],
  ["src/content/adapters/video-card-adapter.ts", content.get("src/content/adapters/video-card-adapter.ts")],
  ["src/content/adapters/home-adapter.ts", content.get("src/content/adapters/home-adapter.ts")],
  ["src/content/adapters/page-matcher.ts", content.get("src/content/adapters/page-matcher.ts")],
  ["src/content/adapters/search-adapter.ts", content.get("src/content/adapters/search-adapter.ts")],
  ["src/content/adapters/video-page-adapter.ts", content.get("src/content/adapters/video-page-adapter.ts")],
  ["src/content/controllers/danmaku-controller.ts", content.get("src/content/controllers/danmaku-controller.ts")],
  ["src/content/renderers/filter-renderer.ts", content.get("src/content/renderers/filter-renderer.ts")],
  ["src/content/route-observer.ts", content.get("src/content/route-observer.ts")],
  ["src/content/bootstrap.ts", content.get("src/content/bootstrap.ts")],
  ["src/popup/index.ts", popup.get("src/popup/index.ts")],
  ["src/options/index.ts", options.get("src/options/index.ts")]
]);

const imports = {
  "src/shared/validation.ts": [
    ["DEFAULT_SETTINGS", "cloneDefaultState", "applyCleanModePreset", "../shared/defaults.js"]
  ],
  "src/storage/settings-repository.ts": [
    ["STORAGE_KEY", "cloneDefaultState", "../shared/defaults.js"],
    ["sanitizeSettings", "sanitizeRules", "sanitizeUserLists", "sanitizeStoredState", "../shared/validation.js"]
  ],
  "src/background/service-worker.ts": [
    ["STORAGE_KEY", "cloneDefaultState", "applyCleanModePreset", "../shared/defaults.js"],
    ["isBackgroundRequest", "../shared/messages.js"],
    ["validateImportBundle", "makeExportBundle", "../shared/validation.js"],
    ["getState", "saveState", "saveSettings", "saveRules", "saveUserLists", "recordFilterStats", "resetStats", "resetState", "../storage/settings-repository.js"]
  ],
  "src/content/core/heuristics.ts": [
    ["normalizeText", "./normalizer.js"]
  ],
  "src/content/core/rule-engine.ts": [
    ["normalizeText", "makeRepeatedCharacterCopy", "normalizeIdentity", "./normalizer.js"],
    ["analyzeQuality", "./heuristics.js"]
  ],
  "src/content/adapters/base-adapter.ts": [
    ["collectOpenShadowRoots", "./dom-utils.js"]
  ],
  "src/content/adapters/entity-parsers.ts": [
    ["SITE_SELECTORS", "./selectors.js"],
    ["normalizeText", "../core/normalizer.js"],
    ["queryDeepFirst", "queryDeepAll", "parseCompactNumber", "parseRelativeTimestamp", "extractSpaceId", "stableElementId", "./dom-utils.js"]
  ],
  "src/content/adapters/video-card-adapter.ts": [
    ["evaluateVideoCard", "../core/rule-engine.js"],
    ["queryAll", "outermostComposedMatch", "./dom-utils.js"],
    ["BaseAdapter", "./base-adapter.js"],
    ["parseVideoCardElement", "./entity-parsers.js"]
  ],
  "src/content/adapters/home-adapter.ts": [
    ["SITE_SELECTORS", "./selectors.js"],
    ["VideoCardAdapter", "./video-card-adapter.js"]
  ],
  "src/content/adapters/search-adapter.ts": [
    ["SITE_SELECTORS", "./selectors.js"],
    ["VideoCardAdapter", "./video-card-adapter.js"]
  ],
  "src/content/adapters/video-page-adapter.ts": [
    ["SITE_SELECTORS", "./selectors.js"],
    ["evaluateComment", "../core/rule-engine.js"],
    ["queryAll", "closestComposed", "./dom-utils.js"],
    ["BaseAdapter", "./base-adapter.js"],
    ["parseCommentElement", "./entity-parsers.js"]
  ],
  "src/content/controllers/danmaku-controller.ts": [
    ["SITE_SELECTORS", "../adapters/selectors.js"],
    ["closestAny", "queryDeepFirst", "../adapters/dom-utils.js"]
  ],
  "src/content/bootstrap.ts": [
    ["STORAGE_KEY", "cloneDefaultState", "isCleaningActive", "../shared/defaults.js"],
    ["sanitizeStoredState", "../shared/validation.js"],
    ["HomeAdapter", "./adapters/home-adapter.js"],
    ["matchSupportedPage", "./adapters/page-matcher.js"],
    ["SearchAdapter", "./adapters/search-adapter.js"],
    ["VideoPageAdapter", "./adapters/video-page-adapter.js"],
    ["DanmakuController", "./controllers/danmaku-controller.js"],
    ["FilterRenderer", "./renderers/filter-renderer.js"],
    ["RouteObserver", "./route-observer.js"]
  ],
  "src/popup/index.ts": [
    ["sendBackgroundRequest", "sendContentRequest", "../shared/client.js"],
    ["applyCleanModePreset", "../shared/defaults.js"]
  ],
  "src/options/index.ts": [
    ["sendBackgroundRequest", "../shared/client.js"],
    ["STORAGE_KEY", "applyCleanModePreset", "../shared/defaults.js"],
    ["sanitizeStoredState", "../shared/validation.js"],
    ["validateRegexPattern", "../content/core/rule-engine.js"]
  ]
};

const entryModules = new Set([
  "src/background/service-worker.ts",
  "src/content/bootstrap.ts",
  "src/popup/index.ts",
  "src/options/index.ts"
]);

for (const [originalPath, body] of selected) {
  if (typeof body !== "string") {
    throw new Error(`安装包中缺少模块标记：${originalPath}`);
  }

  const outputPath = originalPath.replace(/\.ts$/u, ".js");
  const absolutePath = path.join(outputDirectory, outputPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });

  const importLines = (imports[originalPath] ?? []).map((definition) => {
    const specifier = definition.at(-1);
    const names = definition.slice(0, -1).join(", ");
    return `import { ${names} } from "${specifier}";`;
  });

  const recoveredBody = entryModules.has(originalPath)
    ? body
    : body.replace(/^(var |class |(?:async )?function )/gmu, "export $1");

  const source = [
    `// Recovered from BiliClean v0.1.4 distribution module: ${originalPath}`,
    ...importLines,
    importLines.length ? "" : null,
    recoveredBody,
    ""
  ].filter((line) => line !== null).join("\n");

  await writeFile(absolutePath, source, "utf8");
}

console.log(`Recovered ${selected.size} modules into ${outputDirectory}`);
