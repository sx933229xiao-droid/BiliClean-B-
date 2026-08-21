// Recovered from BiliClean v0.1.4 distribution module: src/shared/validation.ts
import { DEFAULT_SETTINGS, cloneDefaultState, applyCleanModePreset } from "../shared/defaults.js";

export var MODES = /* @__PURE__ */ new Set(["light", "standard", "strict", "custom"]);
export var ACTIONS = /* @__PURE__ */ new Set(["hide"]);
export var TARGETS = /* @__PURE__ */ new Set(["comment", "video-title", "author"]);
export var SCOPES = /* @__PURE__ */ new Set(["video", "home", "search", "dynamic", "space"]);
export var MATCHERS = /* @__PURE__ */ new Set(["contains", "whole-word", "prefix", "suffix", "regex"]);
export function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
export function bool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}
export function boundedNumber(value, fallback, min, max) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
export function nullableTimestamp(value) {
  if (value === null) {
    return null;
  }
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
export function cleanStrings(value, limit = 2e3) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(
    value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, limit)
  )];
}
export function cleanCategories(value) {
  const input = isRecord(value) ? value : {};
  const fallback = DEFAULT_SETTINGS.categories;
  return {
    insult: bool(input.insult, fallback.insult),
    sexualInnuendo: bool(input.sexualInnuendo, fallback.sexualInnuendo),
    sexualObjectification: bool(input.sexualObjectification, fallback.sexualObjectification),
    sexualShaming: bool(input.sexualShaming, fallback.sexualShaming),
    provocation: bool(input.provocation, fallback.provocation),
    spam: bool(input.spam, fallback.spam),
    lowInformation: bool(input.lowInformation, fallback.lowInformation)
  };
}
export function sanitizeSettings(value) {
  const input = isRecord(value) ? value : {};
  const modules = isRecord(input.modules) ? input.modules : {};
  const comments = isRecord(input.comments) ? input.comments : {};
  const videos = isRecord(input.videos) ? input.videos : {};
  const danmaku = isRecord(input.danmaku) ? input.danmaku : {};
  const privacy = isRecord(input.privacy) ? input.privacy : {};
  const mode = MODES.has(input.mode) ? input.mode : DEFAULT_SETTINGS.mode;
  const sourceSchemaVersion = typeof input.schemaVersion === "number" ? input.schemaVersion : 1;
  const sanitized = {
    schemaVersion: 3,
    enabled: bool(input.enabled, DEFAULT_SETTINGS.enabled),
    mode,
    pausedUntil: nullableTimestamp(input.pausedUntil),
    modules: {
      comments: bool(modules.comments, DEFAULT_SETTINGS.modules.comments),
      videos: bool(modules.videos, DEFAULT_SETTINGS.modules.videos),
      danmaku: bool(modules.danmaku, DEFAULT_SETTINGS.modules.danmaku)
    },
    comments: {
      // v0.1.2 起评论命中后统一静默隐藏；保留字段仅用于兼容旧导出文件。
      defaultAction: "hide",
      showReasons: false,
      atMentionEnabled: bool(
        comments.atMentionEnabled,
        DEFAULT_SETTINGS.comments.atMentionEnabled
      ),
      atMentionKeepTextLength: boundedNumber(
        comments.atMentionKeepTextLength,
        DEFAULT_SETTINGS.comments.atMentionKeepTextLength,
        0,
        1e4
      ),
      atMentionKeepLikeCount: boundedNumber(
        comments.atMentionKeepLikeCount,
        DEFAULT_SETTINGS.comments.atMentionKeepLikeCount,
        0,
        1e8
      ),
      lowLikeEnabled: bool(comments.lowLikeEnabled, DEFAULT_SETTINGS.comments.lowLikeEnabled),
      maxLowLikeCount: boundedNumber(
        comments.maxLowLikeCount,
        DEFAULT_SETTINGS.comments.maxLowLikeCount,
        0,
        1e6
      ),
      newCommentGraceHours: boundedNumber(
        comments.newCommentGraceHours,
        DEFAULT_SETTINGS.comments.newCommentGraceHours,
        0,
        720
      ),
      minUserLevelEnabled: bool(
        comments.minUserLevelEnabled,
        DEFAULT_SETTINGS.comments.minUserLevelEnabled
      ),
      minUserLevel: boundedNumber(
        comments.minUserLevel,
        DEFAULT_SETTINGS.comments.minUserLevel,
        0,
        6
      ),
      requireCombinedWeakSignals: bool(
        comments.requireCombinedWeakSignals,
        DEFAULT_SETTINGS.comments.requireCombinedWeakSignals
      )
    },
    videos: {
      homeEnabled: bool(videos.homeEnabled, DEFAULT_SETTINGS.videos.homeEnabled),
      searchEnabled: bool(videos.searchEnabled, DEFAULT_SETTINGS.videos.searchEnabled),
      lowViewEnabled: bool(videos.lowViewEnabled, DEFAULT_SETTINGS.videos.lowViewEnabled),
      minViewCount: boundedNumber(
        videos.minViewCount,
        DEFAULT_SETTINGS.videos.minViewCount,
        0,
        1e10
      ),
      shortDurationEnabled: bool(
        videos.shortDurationEnabled,
        DEFAULT_SETTINGS.videos.shortDurationEnabled
      ),
      minDurationSeconds: boundedNumber(
        videos.minDurationSeconds,
        DEFAULT_SETTINGS.videos.minDurationSeconds,
        0,
        86400
      ),
      // v0.1.3 起首页和搜索页视频均静默隐藏，不再生成任何占位提示。
      placeholderMode: "remove"
    },
    danmaku: {
      defaultOff: bool(danmaku.defaultOff, DEFAULT_SETTINGS.danmaku.defaultOff),
      allowManualEnableForCurrentVideo: bool(
        danmaku.allowManualEnableForCurrentVideo,
        DEFAULT_SETTINGS.danmaku.allowManualEnableForCurrentVideo
      )
    },
    categories: cleanCategories(input.categories),
    privacy: {
      // v0.1.4 开始数量统计正式可用；旧版中的占位开关统一迁移为默认开启。
      localStatsEnabled: sourceSchemaVersion < 3 ? true : bool(privacy.localStatsEnabled, DEFAULT_SETTINGS.privacy.localStatsEnabled),
      diagnosticsEnabled: bool(
        privacy.diagnosticsEnabled,
        DEFAULT_SETTINGS.privacy.diagnosticsEnabled
      )
    }
  };
  if (sourceSchemaVersion < 2 && mode === "strict") {
    applyCleanModePreset(sanitized, "strict");
  }
  return sanitized;
}
export function sanitizeStats(value) {
  const input = isRecord(value) ? value : {};
  return {
    commentsBlocked: Math.trunc(boundedNumber(
      input.commentsBlocked,
      0,
      0,
      Number.MAX_SAFE_INTEGER
    )),
    videosBlocked: Math.trunc(boundedNumber(
      input.videosBlocked,
      0,
      0,
      Number.MAX_SAFE_INTEGER
    )),
    startedAt: Math.trunc(boundedNumber(
      input.startedAt,
      Date.now(),
      0,
      Number.MAX_SAFE_INTEGER
    ))
  };
}
export function sanitizeRule(value) {
  if (!isRecord(value)) {
    return null;
  }
  const matcher = isRecord(value.matcher) ? value.matcher : {};
  const id = typeof value.id === "string" ? value.id.slice(0, 100) : "";
  const pattern = typeof matcher.pattern === "string" ? matcher.pattern.slice(0, 500) : "";
  const target = TARGETS.has(value.target) ? value.target : null;
  let rawAction = value.action;
  if (rawAction === "collapse" || rawAction === "blur") {
    rawAction = "hide";
  }
  const action = ACTIONS.has(rawAction) ? rawAction : null;
  const matcherType = MATCHERS.has(matcher.type) ? matcher.type : null;
  if (!id || !pattern || !target || !action || !matcherType) {
    return null;
  }
  const rawScopes = Array.isArray(value.scopes) ? value.scopes.filter((scope) => SCOPES.has(scope)) : [];
  const allowedByTarget = {
    comment: new Set(["video"]),
    "video-title": new Set(["home", "search"]),
    author: new Set(["video", "home", "search"])
  };
  const allowed = allowedByTarget[target] ?? new Set();
  const scopes = rawScopes.filter((scope) => allowed.has(scope));
  const now = Date.now();
  return {
    id,
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim().slice(0, 100) : pattern.slice(0, 30),
    enabled: bool(value.enabled, true),
    priority: boundedNumber(value.priority, 100, -1e4, 1e4),
    target,
    scopes: [...new Set(scopes)].slice(0, 5),
    matcher: {
      type: matcherType,
      pattern,
      caseSensitive: bool(matcher.caseSensitive, false)
    },
    action,
    createdAt: boundedNumber(value.createdAt, now, 0, Number.MAX_SAFE_INTEGER),
    updatedAt: boundedNumber(value.updatedAt, now, 0, Number.MAX_SAFE_INTEGER)
  };
}
export function sanitizeRules(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, 2e3).map(sanitizeRule).filter((rule) => rule !== null).sort((a, b) => b.priority - a.priority);
}
export function sanitizeUserLists(value) {
  const input = isRecord(value) ? value : {};
  return {
    blocked: cleanStrings(input.blocked),
    allowed: cleanStrings(input.allowed),
    uploaderBlocked: cleanStrings(input.uploaderBlocked),
    uploaderAllowed: cleanStrings(input.uploaderAllowed)
  };
}
export function sanitizeStoredState(value) {
  if (!isRecord(value)) {
    return cloneDefaultState();
  }
  return {
    settings: sanitizeSettings(value.settings),
    rules: sanitizeRules(value.rules),
    userLists: sanitizeUserLists(value.userLists),
    stats: sanitizeStats(value.stats)
  };
}
export function validateImportBundle(value) {
  if (!isRecord(value) || value.app !== "BiliClean" || value.exportVersion !== 1) {
    throw new Error("这不是有效的 BiliClean v1 导出文件。");
  }
  if (!isRecord(value.settings) || !Array.isArray(value.rules) || !isRecord(value.userLists)) {
    throw new Error("导入文件缺少设置、规则或名单。");
  }
  return sanitizeStoredState(value);
}
export function makeExportBundle(state) {
  return {
    exportVersion: 1,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    app: "BiliClean",
    ...structuredClone(state)
  };
}
