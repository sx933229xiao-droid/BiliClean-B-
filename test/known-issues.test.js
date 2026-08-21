import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_SETTINGS, cloneDefaultState, applyCleanModePreset } from "../src/shared/defaults.js";
import { sanitizeRule, sanitizeStoredState } from "../src/shared/validation.js";
import { FilterRenderer } from "../src/content/renderers/filter-renderer.js";
import { evaluateComment } from "../src/content/core/rule-engine.js";

function comment(overrides = {}) {
  return {
    id: "comment-1",
    source: "video",
    text: "这是一条正常评论",
    authorId: "100",
    authorName: "用户甲",
    likeCount: 20,
    authorLevel: 6,
    publishTimestamp: Date.now() - 48 * 60 * 60 * 1_000,
    hasAtMention: false,
    ...overrides
  };
}

test("P1-1 离开严格模式时应撤销仅由严格预设写入的设置", () => {
  const state = cloneDefaultState();
  const original = structuredClone(state.settings);

  // standard -> strict -> standard 往返应回到初始
  applyCleanModePreset(state.settings, "strict");
  assert.equal(state.settings.mode, "strict");
  assert.equal(state.settings.comments.lowLikeEnabled, true);
  assert.equal(state.settings.comments.maxLowLikeCount, 1);
  assert.equal(state.settings.comments.requireCombinedWeakSignals, false);

  applyCleanModePreset(state.settings, "standard");
  assert.deepEqual(state.settings.comments.lowLikeEnabled, original.comments.lowLikeEnabled);
  assert.deepEqual(state.settings.comments.maxLowLikeCount, original.comments.maxLowLikeCount);
  assert.deepEqual(state.settings.comments.requireCombinedWeakSignals, original.comments.requireCombinedWeakSignals);
  assert.deepEqual(state.settings.comments.minUserLevelEnabled, original.comments.minUserLevelEnabled);
  assert.deepEqual(state.settings.comments.newCommentGraceHours, original.comments.newCommentGraceHours);

  // standard -> strict 时即使之前把阈值改成 100，严格模式也固定为 1
  const customThreshold = cloneDefaultState();
  customThreshold.settings.comments.maxLowLikeCount = 100;
  applyCleanModePreset(customThreshold.settings, "strict");
  assert.equal(customThreshold.settings.comments.maxLowLikeCount, 1);

  // light / standard 均应重置为非严格
  const light = cloneDefaultState();
  applyCleanModePreset(light.settings, "light");
  assert.equal(light.settings.comments.lowLikeEnabled, false);
  assert.equal(light.settings.comments.requireCombinedWeakSignals, true);

  // 校验低赞过滤在不同模式下行为一致
  const strictState = cloneDefaultState();
  applyCleanModePreset(strictState.settings, "strict");
  const hideInStrict = evaluateComment(comment({ likeCount: 1, publishTimestamp: Date.now() - 48 * 3600 * 1000 }), strictState);
  assert.equal(hideInStrict.action, "hide");

  const standardState = cloneDefaultState();
  applyCleanModePreset(standardState.settings, "standard");
  const showInStandard = evaluateComment(comment({ likeCount: 1, publishTimestamp: Date.now() - 48 * 3600 * 1000 }), standardState);
  assert.equal(showInStandard.action, "show");

  // custom 保持细调值，不被预设覆盖
  const custom = cloneDefaultState();
  custom.settings.mode = "custom";
  custom.settings.comments.lowLikeEnabled = true;
  custom.settings.comments.maxLowLikeCount = 5;
  custom.settings.comments.requireCombinedWeakSignals = false;
  applyCleanModePreset(custom.settings, "custom");
  assert.equal(custom.settings.comments.maxLowLikeCount, 5);
});

test("P1-2 collapse/blur 规则动作应统一迁移为 hide", () => {
  const collapse = sanitizeRule({
    id: "r1",
    name: "t",
    target: "comment",
    action: "collapse",
    matcher: { type: "contains", pattern: "x" },
    scopes: ["video"]
  });
  assert.equal(collapse.action, "hide");

  const blur = sanitizeRule({
    id: "r2",
    name: "t",
    target: "comment",
    action: "blur",
    matcher: { type: "contains", pattern: "x" },
    scopes: ["video"]
  });
  assert.equal(blur.action, "hide");

  const hide = sanitizeRule({
    id: "r3",
    name: "t",
    target: "comment",
    action: "hide",
    matcher: { type: "contains", pattern: "x" },
    scopes: ["video"]
  });
  assert.equal(hide.action, "hide");

  const invalid = sanitizeRule({
    id: "r4",
    name: "t",
    target: "comment",
    action: "invalid",
    matcher: { type: "contains", pattern: "x" },
    scopes: ["video"]
  });
  assert.equal(invalid, null);

  // 旧导出文件中的旧动作应在导入时被迁移
  const imported = sanitizeStoredState({
    settings: { mode: "standard", comments: { defaultAction: "blur" } },
    rules: [
      { id: "old1", name: "old", target: "comment", action: "blur", matcher: { type: "contains", pattern: "bad" }, scopes: ["video"] },
      { id: "old2", name: "old2", target: "author", action: "collapse", matcher: { type: "contains", pattern: "spam" }, scopes: ["home"] }
    ],
    userLists: { blocked: [], allowed: [], uploaderBlocked: [], uploaderAllowed: [] },
    stats: { commentsBlocked: 0, videosBlocked: 0, startedAt: Date.now() }
  });
  assert.equal(imported.rules[0].action, "hide");
  assert.equal(imported.rules[1].action, "hide");
});

test("P1-4 恢复本页内容后重新扫描应能再次处理同一 DOM 元素", () => {
  class MockElement {
    constructor() {
      this.style = {
        _vals: new Map(),
        getPropertyValue(k) { return this._vals.get(k)?.value || ""; },
        getPropertyPriority(k) { return this._vals.get(k)?.priority || ""; },
        setProperty(k, v, p) { this._vals.set(k, { value: v, priority: p }); },
        removeProperty(k) { this._vals.delete(k); }
      };
      this.classList = {
        _s: new Set(),
        add(...a) { a.forEach((x) => this._s.add(x)); },
        remove(...a) { a.forEach((x) => this._s.delete(x)); },
        contains(x) { return this._s.has(x); }
      };
      this.dataset = {};
    }
  }

  const renderer = new FilterRenderer(() => {});
  const el = new MockElement();
  const item = { element: el };
  const hideResult = { action: "hide", reasons: [{ code: "test", label: "test" }] };

  // 首次隐藏
  renderer.applyComment(item, hideResult);
  assert.equal(renderer.records.has(el), true);
  assert.equal(renderer.revealed.has(el), false);

  // 恢复本页
  renderer.showAllTemporarily();
  assert.equal(renderer.records.has(el), false);
  assert.equal(renderer.revealed.has(el), true);

  // 按旧逻辑再次 apply 会被 revealed 拦截，保持可见（bug）
  renderer.applyComment(item, hideResult);
  assert.equal(renderer.records.has(el), false, "未清 revealed 时应仍保持可见");

  // rescan 逻辑：先 clearRevealed 再重扫
  renderer.clearRevealed();
  assert.equal(renderer.revealed.has(el), false);
  renderer.applyComment(item, hideResult);
  assert.equal(renderer.records.has(el), true, "清除 revealed 后应能重新隐藏");

  // rebind 场景：restoreAll(false) 不清 revealed，需额外 clear
  const el2 = new MockElement();
  const item2 = { element: el2 };
  renderer.applyComment(item2, hideResult);
  renderer.showAllTemporarily();
  renderer.restoreAll(false);
  assert.equal(renderer.revealed.has(el2), true, "restoreAll(false) 后 revealed 仍保留");
  renderer.clearRevealed();
  assert.equal(renderer.revealed.has(el2), false);
  renderer.applyComment(item2, hideResult);
  assert.equal(renderer.records.has(el2), true);
});

test("P1-6 目标与 scope 映射应只允许可执行的组合", () => {
  // comment 仅 video
  const cVideo = sanitizeRule({ id: "1", target: "comment", action: "hide", matcher: { type: "contains", pattern: "x" }, scopes: ["video"] });
  assert.deepEqual(cVideo.scopes, ["video"]);
  const cHome = sanitizeRule({ id: "2", target: "comment", action: "hide", matcher: { type: "contains", pattern: "x" }, scopes: ["home"] });
  assert.deepEqual(cHome.scopes, [], "comment 的 home 应被过滤");
  const cMix = sanitizeRule({ id: "3", target: "comment", action: "hide", matcher: { type: "contains", pattern: "x" }, scopes: ["video", "home", "search"] });
  assert.deepEqual(cMix.scopes, ["video"]);

  // video-title 仅 home/search
  const vVideo = sanitizeRule({ id: "4", target: "video-title", action: "hide", matcher: { type: "contains", pattern: "x" }, scopes: ["video"] });
  assert.deepEqual(vVideo.scopes, [], "video-title 的 video 应被过滤（关联推荐未实现）");
  const vHomeSearch = sanitizeRule({ id: "5", target: "video-title", action: "hide", matcher: { type: "contains", pattern: "x" }, scopes: ["home", "search"] });
  assert.deepEqual(vHomeSearch.scopes, ["home", "search"]);
  const vMix = sanitizeRule({ id: "6", target: "video-title", action: "hide", matcher: { type: "contains", pattern: "x" }, scopes: ["video", "home", "dynamic"] });
  assert.deepEqual(vMix.scopes, ["home"]);

  // author 允许 video/home/search，过滤 dynamic/space
  const aAll = sanitizeRule({ id: "7", target: "author", action: "hide", matcher: { type: "contains", pattern: "x" }, scopes: ["video", "home", "search", "dynamic", "space"] });
  assert.deepEqual(aAll.scopes, ["video", "home", "search"]);

  // 旧数据中无效 scope 会被静默迁移为有效子集，而不是保留永远不命中的规则
  const oldImport = sanitizeStoredState({
    settings: DEFAULT_SETTINGS,
    rules: [{ id: "old", name: "old", target: "video-title", action: "hide", matcher: { type: "contains", pattern: "x" }, scopes: ["video"] }],
    userLists: { blocked: [], allowed: [], uploaderBlocked: [], uploaderAllowed: [] },
    stats: { commentsBlocked: 0, videosBlocked: 0, startedAt: Date.now() }
  });
  assert.deepEqual(oldImport.rules[0].scopes, []);
});

test("P1-5 诊断开关应已从界面隐藏", async () => {
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const html = await readFile(path.join(projectRoot, "public/options/index.html"), "utf8");
  // 诊断行应被隐藏（label 含 display:none，且仍保留输入以兼容）
  assert.match(html, /<label[^>]*style="display:none"/);
  assert.match(html, /id="diagnostics"/);
  // 规则动作应仅剩 hide
  assert.doesNotMatch(html, /value="collapse"/);
  assert.doesNotMatch(html, /value="blur"/);
  assert.match(html, /value="hide"/);
  // content 样式不应再包含 blur
  const css = await readFile(path.join(projectRoot, "public/content/style.css"), "utf8");
  assert.doesNotMatch(css, /bc-filter-blur/);
  // 默认设置仍保留字段以兼容旧导出，但默认值应为 false
  assert.equal(DEFAULT_SETTINGS.privacy.diagnosticsEnabled, false);
});

test("P1-3 弹幕控制器在 destroy / rebind 后应正确清理定时器与监听", async () => {
  // 模拟最小浏览器环境
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalLocation = globalThis.location;
  const originalMutationObserver = globalThis.MutationObserver;

  let clickListener = null;
  globalThis.window = globalThis;
  globalThis.location = { pathname: "/video/BV123", search: "" };
  globalThis.MutationObserver = class {
    constructor(cb) { this.cb = cb; this.connected = false; }
    observe() { this.connected = true; }
    disconnect() { this.connected = false; }
  };
  globalThis.document = {
    addEventListener(type, handler) { if (type === "click") clickListener = handler; },
    removeEventListener(type, handler) { if (type === "click" && clickListener === handler) clickListener = null; },
    documentElement: {
      querySelector() { return null; },
      querySelectorAll() { return []; }
    },
    body: null,
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };

  try {
    const { DanmakuController } = await import(`../src/content/controllers/danmaku-controller.js?test=${Date.now()}`);

    const getState = () => ({
      settings: {
        modules: { danmaku: true },
        danmaku: { defaultOff: true, allowManualEnableForCurrentVideo: false }
      }
    });

    const controller = new DanmakuController(getState);
    controller.start();

    assert.equal(typeof clickListener, "function", "start 应注册 click 监听");
    assert.notEqual(controller.mutationObserver, null, "start 应建立 MutationObserver");
    assert.notEqual(controller.retryTimer, null, "start 应调度首次 tryClose");

    // 模拟 7 次 retry 后仍持续调度
    const delays = [];
    const originalSchedule = controller.schedule.bind(controller);
    controller.schedule = (delay) => {
      delays.push(delay);
      return originalSchedule(delay);
    };
    controller.attempt = 0;
    for (let i = 0; i < 9; i++) controller.retry();
    assert.equal(delays.length, 9);
    assert.equal(delays[7], 3000);
    assert.equal(delays[8], 3000, "超过 7 次后仍应以 3s 持续重试");

    // isProgrammaticClose 标志应在 tryClose 期间置位
    // 通过检查 handleTrustedClick 在 programmatic 期间不重复调度
    controller.isProgrammaticClose = true;
    const before = controller.retryTimer;
    controller.handleMutationToggleCheck();
    // programmatic 期间不应触发新的调度
    assert.equal(controller.retryTimer, before);

    // destroy 应清理所有资源
    const retryTimer = controller.retryTimer;
    const verifyTimer = controller.verifyTimer;
    controller.verifyTimer = setTimeout(() => {}, 1000);
    controller.mutationDebounce = setTimeout(() => {}, 1000);
    controller.destroy();
    assert.equal(controller.destroyed, true);
    assert.equal(controller.retryTimer, null);
    assert.equal(controller.verifyTimer, null);
    assert.equal(controller.mutationDebounce, null);
    assert.equal(controller.mutationObserver, null);
    assert.equal(clickListener, null, "destroy 应移除 click 监听");

    // destroy 后再调用 schedule / tryClose 不应产生新定时器
    controller.schedule(0);
    assert.equal(controller.retryTimer, null);
    controller.tryClose();
    assert.equal(controller.status, "unknown");

    // rebind 场景：新建控制器应从干净状态开始
    const controller2 = new DanmakuController(getState);
    controller2.start();
    assert.equal(controller2.attempt, 0);
    assert.equal(controller2.manualAllowedVideo, "");
    assert.equal(controller2.isProgrammaticClose, false);
    controller2.destroy();

    // allowManualEnable=false 时，handleTrustedClick 应对用户打开再次调度
    const controller3 = new DanmakuController(getState);
    // Mock toggle
    const fakeToggle = {
      getAttribute: () => null,
      querySelector: () => null,
      classList: { contains: (c) => c === "on" },
      matches: () => true
    };
    // 临时让 queryDeepFirst 返回 fakeToggle 通过改 document
    globalThis.document.querySelector = () => fakeToggle;
    globalThis.document.querySelectorAll = () => [fakeToggle];
    // 需要让 closestAny 返回 fakeToggle
    const originalClosest = (await import("../src/content/adapters/dom-utils.js")).closestAny;
    // 简化：直接测试 handleTrustedClick 的分支逻辑
    controller3.isProgrammaticClose = false;
    controller3.status = "unknown";
    // 模拟用户点击后 readToggle 为 true，allow=false 应调度
    let scheduled = false;
    controller3.schedule = () => { scheduled = true; };
    controller3.readToggle = () => true;
    controller3.currentVideoKey = () => "/video/BV123";
    // isTrusted 事件
    const event = { isTrusted: true, target: { closest: () => fakeToggle, matches: () => true } };
    // 由于 closestAny 依赖真实 DOM，选择直接调用内部逻辑验证 isProgrammaticClose 保护
    assert.equal(controller3.isProgrammaticClose, false);
    controller3.isProgrammaticClose = true;
    scheduled = false;
    controller3.handleMutationToggleCheck();
    assert.equal(scheduled, false, "programmatic 期间 mutation 检查不应调度");
    controller3.destroy();
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.location = originalLocation;
    globalThis.MutationObserver = originalMutationObserver;
  }
});

test("VideoPageAdapter rescan 应正确处理首批与指纹", async () => {
  const originalElement = globalThis.Element;
  const originalShadowRoot = globalThis.ShadowRoot;
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  // 提供最小 DOM 环境以通过 instanceof 检查
  globalThis.Element = class Element {
    matches() { return false; }
    closest() { return null; }
  };
  globalThis.ShadowRoot = class ShadowRoot {};
  globalThis.window = globalThis;
  globalThis.document = {
    documentElement: {
      querySelectorAll: () => [],
      querySelector: () => null
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {}
  };
  // requestAnimationFrame 的兜底
  if (!globalThis.window.requestAnimationFrame) {
    globalThis.window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  }
  if (!globalThis.cancelAnimationFrame) {
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  }

  try {
    const { VideoPageAdapter } = await import(`../src/content/adapters/video-page-adapter.js?vid=${Date.now()}`);
    let staged = new Set();
    const renderer = {
      stageComment(el) { staged.add(el); },
      unstageComment(el) { staged.delete(el); },
      applyComment() {},
      clearRevealed() {}
    };
    const context = { getState: () => ({ settings: { modules: { comments: true } } }), renderer };
    const fakeController = { start() {}, destroy() {} };
    const adapter = new VideoPageAdapter(context, fakeController);
    assert.equal(adapter.initialBatchComplete, false);
    let flushed = false;
    const originalFlush = adapter.flushInitialBatch.bind(adapter);
    adapter.flushInitialBatch = () => { flushed = true; return originalFlush(); };
    adapter.rescan();
    assert.equal(flushed, true, "未完成首批时 rescan 应触发 flush");
    assert.equal(adapter.initialBatchComplete, true);
    // 再次 rescan 不应重复 flush（已完成）
    flushed = false;
    adapter.rescan();
    assert.equal(flushed, false, "已完成后 rescan 不应再触发 flush");
  } finally {
    globalThis.Element = originalElement;
    globalThis.ShadowRoot = originalShadowRoot;
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    if (globalThis.cancelAnimationFrame === ((id) => clearTimeout(id))) {
      delete globalThis.cancelAnimationFrame;
    }
  }
});
