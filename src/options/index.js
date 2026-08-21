// Recovered from BiliClean v0.1.4 distribution module: src/options/index.ts
import { sendBackgroundRequest } from "../shared/client.js";
import { STORAGE_KEY, applyCleanModePreset } from "../shared/defaults.js";
import { sanitizeStoredState } from "../shared/validation.js";
import { validateRegexPattern } from "../content/core/rule-engine.js";

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
const TARGET_SCOPE_MAP = {
  comment: ["video"],
  "video-title": ["home", "search"],
  author: ["video", "home", "search"]
};
function updateScopeAvailability() {
  const target = element("rule-target").value;
  const allowed = new Set(TARGET_SCOPE_MAP[target] ?? []);
  document.querySelectorAll("[data-scope]").forEach((input) => {
    const scope = input.dataset.scope;
    const isAllowed = allowed.has(scope);
    input.disabled = !isAllowed;
    const label = input.closest("label");
    if (label) {
      label.style.opacity = isAllowed ? "" : "0.45";
      label.title = isAllowed ? "" : "该目标在此页面作用域暂未支持";
    }
    if (!isAllowed) {
      input.checked = false;
    }
  });
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
  if (selectedMode !== previousMode && selectedMode !== "custom") {
    applyCleanModePreset(settings, selectedMode);
    checkbox("low-like-enabled").checked = settings.comments.lowLikeEnabled;
    checkbox("combine-weak").checked = settings.comments.requireCombinedWeakSignals;
    checkbox("min-level-enabled").checked = settings.comments.minUserLevelEnabled;
    element("max-low-like").value = String(settings.comments.maxLowLikeCount);
    element("min-level").value = String(settings.comments.minUserLevel);
    element("grace-hours").value = String(settings.comments.newCommentGraceHours);
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
  updateScopeAvailability();
  document.querySelectorAll("[data-scope]").forEach((input) => {
    input.checked = !input.disabled && rule.scopes.includes(input.dataset.scope);
  });
  if (rule.scopes.length === 0) {
    document.querySelectorAll("[data-scope]").forEach((input) => {
      if (!input.disabled) {
        input.checked = true;
      }
    });
  }
  cancelEdit.style.display = "inline-flex";
  ruleError.textContent = "";
  element("rule-pattern").focus();
  ruleForm.scrollIntoView({ block: "center" });
}
function resetRuleForm() {
  ruleForm.reset();
  element("rule-id").value = "";
  element("rule-priority").value = "100";
  updateScopeAvailability();
  const target = element("rule-target").value;
  const allowed = TARGET_SCOPE_MAP[target] ?? [];
  document.querySelectorAll("[data-scope]").forEach((input) => {
    input.checked = allowed.includes(input.dataset.scope ?? "");
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
  const target = element("rule-target").value;
  const allowedScopes = new Set(TARGET_SCOPE_MAP[target] ?? []);
  const rawScopes = [...document.querySelectorAll("[data-scope]")].filter((input) => input.checked).map((input) => input.dataset.scope);
  const scopes = rawScopes.filter((scope) => allowedScopes.has(scope));
  if (rawScopes.length !== scopes.length) {
    ruleError.textContent = "存在不支持的作用域，已自动过滤为有效范围。";
  } else {
    ruleError.textContent = "";
  }
  const rule = {
    id: existing?.id ?? crypto.randomUUID(),
    name: element("rule-name").value.trim() || pattern.slice(0, 30),
    enabled: existing?.enabled ?? true,
    priority: numberValue("rule-priority", 100),
    target,
    scopes,
    matcher: {
      type: matcher,
      pattern,
      caseSensitive: checkbox("rule-case-sensitive").checked
    },
    action: "hide",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  state.rules = existing ? state.rules.map((item) => item.id === rule.id ? rule : item) : [...state.rules, rule];
  resetRuleForm();
  void persistRules().catch(showError);
});
cancelEdit.addEventListener("click", resetRuleForm);
element("rule-target").addEventListener("change", updateScopeAvailability);
updateScopeAvailability();
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
