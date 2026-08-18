"use strict";
(() => {
  // src/shared/client.ts
  async function sendBackgroundRequest(request) {
    return chrome.runtime.sendMessage(request);
  }

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
    const state2 = structuredClone(DEFAULT_STATE);
    state2.stats.startedAt = Date.now();
    return state2;
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

  // src/content/core/rule-engine.ts
  function validateRegexPattern(pattern) {
    if (pattern.length > 200) {
      return "正则表达式不能超过 200 个字符。";
    }
    if (/(?:\([^)]*[+*][^)]*\))[+*{]/u.test(pattern) || /(?:\.\*){2,}/u.test(pattern)) {
      return "正则表达式包含可能造成严重回溯的嵌套量词。";
    }
    try {
      void new RegExp(pattern, "u");
      return null;
    } catch {
      return "正则表达式无效。";
    }
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

  // src/options/index.ts
  function element(id) {
    const found = document.getElementById(id);
    if (!found) {
      throw new Error(`缺少界面元素：${id}`);
    }
    return found;
  }
  function checkbox(id) {
    return element(id);
  }
  function numberValue(id, fallback) {
    const value = Number(element(id).value);
    return Number.isFinite(value) ? value : fallback;
  }
  function lines(value) {
    return [...new Set(value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean))];
  }
  var saveStatus = element("save-status");
  var ruleForm = element("rule-form");
  var ruleList = element("rule-list");
  var ruleError = element("rule-error");
  var cancelEdit = element("cancel-edit");
  var state = null;
  var statusTimer = null;
  function setStatus(text, kind = "neutral") {
    saveStatus.textContent = text;
    saveStatus.className = `save-status ${kind === "neutral" ? "" : kind}`.trim();
    if (statusTimer !== null) {
      window.clearTimeout(statusTimer);
    }
    if (kind === "success") {
      statusTimer = window.setTimeout(() => {
        saveStatus.textContent = "设置已保存在本地";
        saveStatus.className = "save-status";
      }, 1800);
    }
  }
  async function load() {
    const response = await sendBackgroundRequest({ type: "BC_GET_STATE" });
    if (!response.ok || !("state" in response)) {
      throw new Error(response.ok ? "设置响应无效。" : response.error);
    }
    state = response.state;
    renderAll();
    setStatus("设置已保存在本地");
  }
  function renderAll() {
    if (!state) {
      return;
    }
    const settings = state.settings;
    checkbox("enabled").checked = settings.enabled;
    element("mode").value = settings.mode;
    checkbox("module-comments").checked = settings.modules.comments;
    checkbox("module-videos").checked = settings.modules.videos;
    checkbox("module-danmaku").checked = settings.modules.danmaku;
    checkbox("at-mention-enabled").checked = settings.comments.atMentionEnabled;
    element("at-mention-text-length").value = String(
      settings.comments.atMentionKeepTextLength
    );
    element("at-mention-like-count").value = String(
      settings.comments.atMentionKeepLikeCount
    );
    checkbox("combine-weak").checked = settings.comments.requireCombinedWeakSignals;
    checkbox("low-like-enabled").checked = settings.comments.lowLikeEnabled;
    element("max-low-like").value = String(settings.comments.maxLowLikeCount);
    element("grace-hours").value = String(settings.comments.newCommentGraceHours);
    checkbox("min-level-enabled").checked = settings.comments.minUserLevelEnabled;
    element("min-level").value = String(settings.comments.minUserLevel);
    checkbox("home-videos").checked = settings.videos.homeEnabled;
    checkbox("search-videos").checked = settings.videos.searchEnabled;
    checkbox("low-view-enabled").checked = settings.videos.lowViewEnabled;
    element("min-view-count").value = String(settings.videos.minViewCount);
    checkbox("short-duration-enabled").checked = settings.videos.shortDurationEnabled;
    element("min-duration-seconds").value = String(
      settings.videos.minDurationSeconds
    );
    checkbox("danmaku-off").checked = settings.danmaku.defaultOff;
    checkbox("danmaku-manual").checked = settings.danmaku.allowManualEnableForCurrentVideo;
    checkbox("local-stats").checked = settings.privacy.localStatsEnabled;
    checkbox("diagnostics").checked = settings.privacy.diagnosticsEnabled;
    document.querySelectorAll("[data-category]").forEach((input) => {
      const key = input.dataset.category;
      input.checked = settings.categories[key];
    });
    element("blocked-users").value = state.userLists.blocked.join("\n");
    element("allowed-users").value = state.userLists.allowed.join("\n");
    element("blocked-uploaders").value = state.userLists.uploaderBlocked.join("\n");
    element("allowed-uploaders").value = state.userLists.uploaderAllowed.join("\n");
    renderStats();
    renderRules();
  }
  function renderStats() {
    if (!state) {
      return;
    }
    element("stats-comments").textContent = state.stats.commentsBlocked.toLocaleString("zh-CN");
    element("stats-videos").textContent = state.stats.videosBlocked.toLocaleString("zh-CN");
    const startedAt = new Date(state.stats.startedAt);
    const startText = Number.isFinite(startedAt.getTime()) ? startedAt.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }) : "本次安装";
    element("stats-since").textContent = state.settings.privacy.localStatsEnabled ? `自 ${startText} 起累计` : `自 ${startText} 起累计（当前已暂停记录）`;
  }
  async function persistSettings() {
    if (!state) {
      return;
    }
    setStatus("正在保存…");
    const response = await sendBackgroundRequest({
      type: "BC_SAVE_SETTINGS",
      settings: state.settings
    });
    if (!response.ok || !("state" in response)) {
      throw new Error(response.ok ? "设置响应无效。" : response.error);
    }
    state = response.state;
    setStatus("已保存", "success");
  }
  async function persistRules() {
    if (!state) {
      return;
    }
    const response = await sendBackgroundRequest({ type: "BC_SAVE_RULES", rules: state.rules });
    if (!response.ok || !("state" in response)) {
      throw new Error(response.ok ? "规则响应无效。" : response.error);
    }
    state = response.state;
    renderRules();
    setStatus("规则已保存", "success");
  }
  function settingsChanged() {
    if (!state) {
      return;
    }
    const settings = state.settings;
    const previousMode = settings.mode;
    const selectedMode = element("mode").value;
    settings.enabled = checkbox("enabled").checked;
    settings.mode = selectedMode;
    settings.modules.comments = checkbox("module-comments").checked;
    settings.modules.videos = checkbox("module-videos").checked;
    settings.modules.danmaku = checkbox("module-danmaku").checked;
    settings.comments.defaultAction = "hide";
    settings.comments.showReasons = false;
    settings.comments.atMentionEnabled = checkbox("at-mention-enabled").checked;
    settings.comments.atMentionKeepTextLength = Math.max(
      0,
      numberValue("at-mention-text-length", 50)
    );
    settings.comments.atMentionKeepLikeCount = Math.max(
      0,
      numberValue("at-mention-like-count", 100)
    );
    settings.comments.requireCombinedWeakSignals = checkbox("combine-weak").checked;
    settings.comments.lowLikeEnabled = checkbox("low-like-enabled").checked;
    settings.comments.maxLowLikeCount = Math.max(0, numberValue("max-low-like", 0));
    settings.comments.newCommentGraceHours = Math.max(0, numberValue("grace-hours", 24));
    settings.comments.minUserLevelEnabled = checkbox("min-level-enabled").checked;
    settings.comments.minUserLevel = Math.min(6, Math.max(0, numberValue("min-level", 1)));
    settings.videos.homeEnabled = checkbox("home-videos").checked;
    settings.videos.searchEnabled = checkbox("search-videos").checked;
    settings.videos.lowViewEnabled = checkbox("low-view-enabled").checked;
    settings.videos.minViewCount = Math.max(0, numberValue("min-view-count", 5e4));
    settings.videos.shortDurationEnabled = checkbox("short-duration-enabled").checked;
    settings.videos.minDurationSeconds = Math.max(
      0,
      numberValue("min-duration-seconds", 60)
    );
    settings.videos.placeholderMode = "remove";
    settings.danmaku.defaultOff = checkbox("danmaku-off").checked;
    settings.danmaku.allowManualEnableForCurrentVideo = checkbox("danmaku-manual").checked;
    settings.privacy.localStatsEnabled = checkbox("local-stats").checked;
    settings.privacy.diagnosticsEnabled = checkbox("diagnostics").checked;
    document.querySelectorAll("[data-category]").forEach((input) => {
      const key = input.dataset.category;
      settings.categories[key] = input.checked;
    });
    if (selectedMode === "strict" && previousMode !== "strict") {
      applyCleanModePreset(settings, selectedMode);
      checkbox("low-like-enabled").checked = true;
      checkbox("combine-weak").checked = false;
      element("max-low-like").value = String(
        settings.comments.maxLowLikeCount
      );
    }
    void persistSettings().catch(showError);
  }
  document.querySelectorAll(
    '#overview input, #overview select, #comments input, #comments select, #videos input, #videos select, #data input[type="checkbox"]'
  ).forEach((input) => input.addEventListener("change", settingsChanged));
  function renderRules() {
    ruleList.replaceChildren();
    if (!state || state.rules.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "还没有自定义规则。内置类别仍会按照净化模式工作。";
      ruleList.append(empty);
      return;
    }
    const labels = {
      comment: "评论",
      "video-title": "视频标题",
      author: "作者"
    };
    const sorted = [...state.rules].sort((a, b) => b.priority - a.priority);
    for (const [index, rule] of sorted.entries()) {
      const row = document.createElement("article");
      row.className = "rule-item";
      const enabled = document.createElement("input");
      enabled.type = "checkbox";
      enabled.checked = rule.enabled;
      enabled.setAttribute("aria-label", `启用规则：${rule.name}`);
      enabled.addEventListener("change", () => {
        rule.enabled = enabled.checked;
        rule.updatedAt = Date.now();
        void persistRules().catch(showError);
      });
      const copy = document.createElement("div");
      copy.className = "rule-copy";
      const title = document.createElement("strong");
      title.textContent = rule.name;
      const detail = document.createElement("span");
      detail.textContent = `${labels[rule.target]} · ${rule.matcher.type} “${rule.matcher.pattern}” · ${rule.action} · 优先级 ${rule.priority}`;
      copy.append(title, detail);
      const actions = document.createElement("div");
      actions.className = "rule-actions";
      actions.append(
        actionButton("上移", () => moveRule(sorted, index, -1), index === 0),
        actionButton("下移", () => moveRule(sorted, index, 1), index === sorted.length - 1),
        actionButton("编辑", () => editRule(rule)),
        actionButton("删除", () => deleteRule(rule), false, true)
      );
      row.append(enabled, copy, actions);
      ruleList.append(row);
    }
  }
  function actionButton(label, handler, disabled = false, danger = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;
    if (danger) {
      button.classList.add("danger-button");
    }
    button.addEventListener("click", handler);
    return button;
  }
  function moveRule(sorted, index, delta) {
    const current = sorted[index];
    const other = sorted[index + delta];
    if (!current || !other) {
      return;
    }
    const currentPriority = current.priority;
    current.priority = other.priority;
    other.priority = currentPriority;
    if (current.priority === other.priority) {
      current.priority += delta < 0 ? 1 : -1;
    }
    current.updatedAt = Date.now();
    other.updatedAt = Date.now();
    void persistRules().catch(showError);
  }
  function editRule(rule) {
    element("rule-id").value = rule.id;
    element("rule-name").value = rule.name;
    element("rule-pattern").value = rule.matcher.pattern;
    element("rule-target").value = rule.target;
    element("rule-matcher").value = rule.matcher.type;
    element("rule-action").value = rule.action;
    element("rule-priority").value = String(rule.priority);
    checkbox("rule-case-sensitive").checked = rule.matcher.caseSensitive;
    document.querySelectorAll("[data-scope]").forEach((input) => {
      input.checked = rule.scopes.includes(input.dataset.scope);
    });
    cancelEdit.style.display = "inline-flex";
    ruleError.textContent = "";
    element("rule-pattern").focus();
    ruleForm.scrollIntoView({ block: "center" });
  }
  function resetRuleForm() {
    ruleForm.reset();
    element("rule-id").value = "";
    element("rule-priority").value = "100";
    document.querySelectorAll("[data-scope]").forEach((input) => {
      input.checked = ["video", "home", "search"].includes(input.dataset.scope ?? "");
    });
    cancelEdit.style.display = "none";
    ruleError.textContent = "";
  }
  function deleteRule(rule) {
    if (!state || !window.confirm(`删除规则“${rule.name}”？`)) {
      return;
    }
    state.rules = state.rules.filter((item) => item.id !== rule.id);
    void persistRules().catch(showError);
  }
  ruleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state) {
      return;
    }
    const pattern = element("rule-pattern").value.trim();
    const matcher = element("rule-matcher").value;
    if (!pattern) {
      ruleError.textContent = "请输入匹配内容。";
      return;
    }
    if (matcher === "regex") {
      const error = validateRegexPattern(pattern);
      if (error) {
        ruleError.textContent = error;
        return;
      }
    }
    const idField = element("rule-id");
    const existing = state.rules.find((rule2) => rule2.id === idField.value);
    const now = Date.now();
    const scopes = [...document.querySelectorAll("[data-scope]")].filter((input) => input.checked).map((input) => input.dataset.scope);
    const rule = {
      id: existing?.id ?? crypto.randomUUID(),
      name: element("rule-name").value.trim() || pattern.slice(0, 30),
      enabled: existing?.enabled ?? true,
      priority: numberValue("rule-priority", 100),
      target: element("rule-target").value,
      scopes,
      matcher: {
        type: matcher,
        pattern,
        caseSensitive: checkbox("rule-case-sensitive").checked
      },
      action: element("rule-action").value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    state.rules = existing ? state.rules.map((item) => item.id === rule.id ? rule : item) : [...state.rules, rule];
    resetRuleForm();
    void persistRules().catch(showError);
  });
  cancelEdit.addEventListener("click", resetRuleForm);
  element("save-lists").addEventListener("click", async () => {
    if (!state) {
      return;
    }
    state.userLists = {
      blocked: lines(element("blocked-users").value),
      allowed: lines(element("allowed-users").value),
      uploaderBlocked: lines(element("blocked-uploaders").value),
      uploaderAllowed: lines(element("allowed-uploaders").value)
    };
    const response = await sendBackgroundRequest({
      type: "BC_SAVE_LISTS",
      userLists: state.userLists
    });
    if (!response.ok || !("state" in response)) {
      throw new Error(response.ok ? "名单响应无效。" : response.error);
    }
    state = response.state;
    renderAll();
    setStatus("名单已保存", "success");
  });
  element("export-button").addEventListener("click", async () => {
    const response = await sendBackgroundRequest({ type: "BC_EXPORT_STATE" });
    if (!response.ok || !("bundle" in response)) {
      throw new Error(response.ok ? "导出响应无效。" : response.error);
    }
    const blob = new Blob([`${JSON.stringify(response.bundle, null, 2)}
`], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `BiliClean-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("备份已导出", "success");
  });
  element("import-file").addEventListener("change", async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    try {
      const bundle = JSON.parse(await file.text());
      const response = await sendBackgroundRequest({ type: "BC_IMPORT_STATE", bundle });
      if (!response.ok || !("state" in response)) {
        throw new Error(response.ok ? "导入响应无效。" : response.error);
      }
      state = response.state;
      renderAll();
      setStatus("导入成功", "success");
    } catch (error) {
      showError(error);
    } finally {
      input.value = "";
    }
  });
  element("reset-stats").addEventListener("click", async () => {
    if (!window.confirm("将累计屏蔽的视频和评论数量清零？")) {
      return;
    }
    const response = await sendBackgroundRequest({ type: "BC_RESET_STATS" });
    if (!response.ok || !("state" in response)) {
      throw new Error(response.ok ? "统计响应无效。" : response.error);
    }
    state = response.state;
    renderStats();
    setStatus("统计已清零", "success");
  });
  element("reset-button").addEventListener("click", async () => {
    if (!window.confirm("恢复默认设置并清除全部自定义规则、名单与累计统计？")) {
      return;
    }
    const response = await sendBackgroundRequest({ type: "BC_RESET_STATE" });
    if (!response.ok || !("state" in response)) {
      throw new Error(response.ok ? "重置响应无效。" : response.error);
    }
    state = response.state;
    resetRuleForm();
    renderAll();
    setStatus("已恢复默认设置", "success");
  });
  function showError(error) {
    setStatus(error instanceof Error ? error.message : "操作失败", "error");
  }
  window.addEventListener("unhandledrejection", (event) => showError(event.reason));
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]?.newValue) {
      return;
    }
    const nextState = sanitizeStoredState(changes[STORAGE_KEY].newValue);
    const configurationChanged = !state || JSON.stringify({
      settings: state.settings,
      rules: state.rules,
      userLists: state.userLists
    }) !== JSON.stringify({
      settings: nextState.settings,
      rules: nextState.rules,
      userLists: nextState.userLists
    });
    state = nextState;
    if (configurationChanged) {
      renderAll();
    } else {
      renderStats();
    }
  });
  void load().catch(showError);
})();
