// src/shared/defaults.ts
var STORAGE_KEY = "biliclean.state.v1";
var DEFAULT_SETTINGS = {
  schemaVersion: 3,
  enabled: true,
  mode: "standard",
  pausedUntil: null,
  modules: {
    comments: true,
    videos: true,
    danmaku: true
  },
  comments: {
    defaultAction: "hide",
    showReasons: false,
    atMentionEnabled: true,
    atMentionKeepTextLength: 50,
    atMentionKeepLikeCount: 100,
    lowLikeEnabled: false,
    maxLowLikeCount: 1,
    newCommentGraceHours: 24,
    minUserLevelEnabled: false,
    minUserLevel: 1,
    requireCombinedWeakSignals: true
  },
  videos: {
    homeEnabled: true,
    searchEnabled: true,
    lowViewEnabled: true,
    minViewCount: 5e4,
    shortDurationEnabled: true,
    minDurationSeconds: 60,
    placeholderMode: "remove"
  },
  danmaku: {
    defaultOff: true,
    allowManualEnableForCurrentVideo: true
  },
  categories: {
    insult: true,
    sexualInnuendo: true,
    sexualObjectification: true,
    sexualShaming: true,
    provocation: true,
    spam: true,
    lowInformation: false
  },
  privacy: {
    localStatsEnabled: true,
    diagnosticsEnabled: false
  }
};
var DEFAULT_STATE = {
  settings: DEFAULT_SETTINGS,
  rules: [],
  userLists: {
    blocked: [],
    allowed: [],
    uploaderBlocked: [],
    uploaderAllowed: []
  },
  stats: {
    commentsBlocked: 0,
    videosBlocked: 0,
    startedAt: 0
  }
};
function cloneDefaultState() {
  const state = structuredClone(DEFAULT_STATE);
  state.stats.startedAt = Date.now();
  return state;
}
function applyCleanModePreset(settings, mode) {
  settings.mode = mode;
  if (mode === "strict") {
    settings.comments.lowLikeEnabled = true;
    settings.comments.maxLowLikeCount = Math.max(1, settings.comments.maxLowLikeCount);
    settings.comments.requireCombinedWeakSignals = false;
  }
  return settings;
}

// src/shared/messages.ts
var BACKGROUND_TYPES = /* @__PURE__ */ new Set([
  "BC_GET_STATE",
  "BC_SAVE_SETTINGS",
  "BC_SAVE_RULES",
  "BC_SAVE_LISTS",
  "BC_RECORD_FILTERS",
  "BC_RESET_STATS",
  "BC_EXPORT_STATE",
  "BC_IMPORT_STATE",
  "BC_RESET_STATE"
]);
function isBackgroundRequest(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const type = value.type;
  if (typeof type !== "string" || !BACKGROUND_TYPES.has(type)) {
    return false;
  }
  if (type === "BC_RECORD_FILTERS") {
    const request = value;
    return typeof request.commentsBlocked === "number" && Number.isFinite(request.commentsBlocked) && request.commentsBlocked >= 0 && request.commentsBlocked <= 1e4 && typeof request.videosBlocked === "number" && Number.isFinite(request.videosBlocked) && request.videosBlocked >= 0 && request.videosBlocked <= 1e4;
  }
  return true;
}

// src/shared/validation.ts
var MODES = /* @__PURE__ */ new Set(["light", "standard", "strict", "custom"]);
var ACTIONS = /* @__PURE__ */ new Set(["collapse", "blur", "hide"]);
var TARGETS = /* @__PURE__ */ new Set(["comment", "video-title", "author"]);
var SCOPES = /* @__PURE__ */ new Set(["video", "home", "search", "dynamic", "space"]);
var MATCHERS = /* @__PURE__ */ new Set(["contains", "whole-word", "prefix", "suffix", "regex"]);
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function bool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}
function boundedNumber(value, fallback, min, max) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function nullableTimestamp(value) {
  if (value === null) {
    return null;
  }
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function cleanStrings(value, limit = 2e3) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(
    value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, limit)
  )];
}
function cleanCategories(value) {
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
function sanitizeSettings(value) {
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
function sanitizeStats(value) {
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
function sanitizeRule(value) {
  if (!isRecord(value)) {
    return null;
  }
  const matcher = isRecord(value.matcher) ? value.matcher : {};
  const id = typeof value.id === "string" ? value.id.slice(0, 100) : "";
  const pattern = typeof matcher.pattern === "string" ? matcher.pattern.slice(0, 500) : "";
  const target = TARGETS.has(value.target) ? value.target : null;
  const action = ACTIONS.has(value.action) ? value.action : null;
  const matcherType = MATCHERS.has(matcher.type) ? matcher.type : null;
  if (!id || !pattern || !target || !action || !matcherType) {
    return null;
  }
  const scopes = Array.isArray(value.scopes) ? value.scopes.filter((scope) => SCOPES.has(scope)) : [];
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
function sanitizeRules(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, 2e3).map(sanitizeRule).filter((rule) => rule !== null).sort((a, b) => b.priority - a.priority);
}
function sanitizeUserLists(value) {
  const input = isRecord(value) ? value : {};
  return {
    blocked: cleanStrings(input.blocked),
    allowed: cleanStrings(input.allowed),
    uploaderBlocked: cleanStrings(input.uploaderBlocked),
    uploaderAllowed: cleanStrings(input.uploaderAllowed)
  };
}
function sanitizeStoredState(value) {
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
function validateImportBundle(value) {
  if (!isRecord(value) || value.app !== "BiliClean" || value.exportVersion !== 1) {
    throw new Error("这不是有效的 BiliClean v1 导出文件。");
  }
  if (!isRecord(value.settings) || !Array.isArray(value.rules) || !isRecord(value.userLists)) {
    throw new Error("导入文件缺少设置、规则或名单。");
  }
  return sanitizeStoredState(value);
}
function makeExportBundle(state) {
  return {
    exportVersion: 1,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    app: "BiliClean",
    ...structuredClone(state)
  };
}

// src/storage/settings-repository.ts
var writeQueue = Promise.resolve();
function enqueueWrite(operation) {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(() => void 0, () => void 0);
  return result;
}
async function writeStateDirect(state) {
  const sanitized = sanitizeStoredState(state);
  await chrome.storage.local.set({ [STORAGE_KEY]: sanitized });
  return sanitized;
}
async function getState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (raw === void 0) {
    const initial = cloneDefaultState();
    await chrome.storage.local.set({ [STORAGE_KEY]: initial });
    return initial;
  }
  const sanitized = sanitizeStoredState(raw);
  if (JSON.stringify(raw) !== JSON.stringify(sanitized)) {
    await chrome.storage.local.set({ [STORAGE_KEY]: sanitized });
  }
  return sanitized;
}
async function saveState(state) {
  return enqueueWrite(() => writeStateDirect(state));
}
async function saveSettings(settings) {
  return enqueueWrite(async () => {
    const state = await getState();
    state.settings = sanitizeSettings(settings);
    return writeStateDirect(state);
  });
}
async function saveRules(rules) {
  return enqueueWrite(async () => {
    const state = await getState();
    state.rules = sanitizeRules(rules);
    return writeStateDirect(state);
  });
}
async function saveUserLists(userLists) {
  return enqueueWrite(async () => {
    const state = await getState();
    state.userLists = sanitizeUserLists(userLists);
    return writeStateDirect(state);
  });
}
async function recordFilterStats(delta) {
  return enqueueWrite(async () => {
    const state = await getState();
    if (!state.settings.privacy.localStatsEnabled) {
      return state;
    }
    state.stats.commentsBlocked = Math.min(
      Number.MAX_SAFE_INTEGER,
      state.stats.commentsBlocked + Math.max(0, Math.trunc(delta.commentsBlocked))
    );
    state.stats.videosBlocked = Math.min(
      Number.MAX_SAFE_INTEGER,
      state.stats.videosBlocked + Math.max(0, Math.trunc(delta.videosBlocked))
    );
    return writeStateDirect(state);
  });
}
async function resetStats() {
  return enqueueWrite(async () => {
    const state = await getState();
    state.stats = {
      commentsBlocked: 0,
      videosBlocked: 0,
      startedAt: Date.now()
    };
    return writeStateDirect(state);
  });
}
async function resetState() {
  return enqueueWrite(() => writeStateDirect(cloneDefaultState()));
}

// src/background/service-worker.ts
chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    const state = await getState();
    if (details.reason === "update" && details.previousVersion === "0.1.0" && state.settings.mode === "strict") {
      applyCleanModePreset(state.settings, "strict");
      await saveState(state);
    }
  })();
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isBackgroundRequest(message)) {
    return false;
  }
  if (sender.id && sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: "拒绝来自未知扩展的消息。" });
    return false;
  }
  void (async () => {
    switch (message.type) {
      case "BC_GET_STATE":
        return { ok: true, state: await getState() };
      case "BC_SAVE_SETTINGS":
        return { ok: true, state: await saveSettings(message.settings) };
      case "BC_SAVE_RULES":
        return { ok: true, state: await saveRules(message.rules) };
      case "BC_SAVE_LISTS":
        return { ok: true, state: await saveUserLists(message.userLists) };
      case "BC_RECORD_FILTERS":
        return {
          ok: true,
          state: await recordFilterStats({
            commentsBlocked: message.commentsBlocked,
            videosBlocked: message.videosBlocked
          })
        };
      case "BC_RESET_STATS":
        return { ok: true, state: await resetStats() };
      case "BC_EXPORT_STATE":
        return { ok: true, bundle: makeExportBundle(await getState()) };
      case "BC_IMPORT_STATE":
        return { ok: true, state: await saveState(validateImportBundle(message.bundle)) };
      case "BC_RESET_STATE":
        return { ok: true, state: await resetState() };
      default:
        return { ok: false, error: "未知消息。" };
    }
  })().then(sendResponse).catch((error) => {
    const text = error instanceof Error ? error.message : "未知错误";
    sendResponse({ ok: false, error: text });
  });
  return true;
});
void getState().catch(() => {
  void chrome.storage.local.set({ [STORAGE_KEY]: cloneDefaultState() });
});
