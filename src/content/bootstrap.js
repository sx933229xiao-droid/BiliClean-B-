// Recovered from BiliClean v0.1.4 distribution module: src/content/bootstrap.ts
import { STORAGE_KEY, cloneDefaultState, isCleaningActive } from "../shared/defaults.js";
import { sanitizeStoredState } from "../shared/validation.js";
import { HomeAdapter } from "./adapters/home-adapter.js";
import { matchSupportedPage } from "./adapters/page-matcher.js";
import { SearchAdapter } from "./adapters/search-adapter.js";
import { VideoPageAdapter } from "./adapters/video-page-adapter.js";
import { DanmakuController } from "./controllers/danmaku-controller.js";
import { FilterRenderer } from "./renderers/filter-renderer.js";
import { RouteObserver } from "./route-observer.js";

var BiliCleanApp = class {
  state = cloneDefaultState();
  renderer = new FilterRenderer((kind) => this.queueFilterStat(kind));
  routeObserver = new RouteObserver(() => this.rebind());
  adapter = null;
  danmakuController = null;
  pauseTimer = null;
  statsTimer = null;
  pendingCommentStats = 0;
  pendingVideoStats = 0;
  async start() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "BC_GET_STATE" });
      if (response && typeof response === "object" && "ok" in response && response.ok && "state" in response) {
        this.state = sanitizeStoredState(response.state);
      }
    } catch {
      this.state = cloneDefaultState();
    }
    chrome.storage.onChanged.addListener(this.handleStorageChange);
    chrome.runtime.onMessage.addListener(this.handleMessage);
    window.addEventListener("pagehide", () => this.flushFilterStats());
    this.routeObserver.start();
    this.schedulePauseWake();
    this.rebind();
  }
  handleStorageChange = (changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]?.newValue) {
      return;
    }
    const nextState = sanitizeStoredState(changes[STORAGE_KEY].newValue);
    const filteringConfigurationChanged = JSON.stringify({
      settings: this.state.settings,
      rules: this.state.rules,
      userLists: this.state.userLists
    }) !== JSON.stringify({
      settings: nextState.settings,
      rules: nextState.rules,
      userLists: nextState.userLists
    });
    this.state = nextState;
    if (!filteringConfigurationChanged) {
      return;
    }
    this.schedulePauseWake();
    this.rebind();
  };
  queueFilterStat(kind) {
    if (!this.state.settings.privacy.localStatsEnabled) {
      return;
    }
    if (kind === "comment") {
      this.pendingCommentStats += 1;
    } else {
      this.pendingVideoStats += 1;
    }
    if (this.statsTimer === null) {
      this.statsTimer = window.setTimeout(() => this.flushFilterStats(), 250);
    }
  }
  flushFilterStats() {
    if (this.statsTimer !== null) {
      window.clearTimeout(this.statsTimer);
      this.statsTimer = null;
    }
    const commentsBlocked = this.pendingCommentStats;
    const videosBlocked = this.pendingVideoStats;
    this.pendingCommentStats = 0;
    this.pendingVideoStats = 0;
    if (commentsBlocked === 0 && videosBlocked === 0) {
      return;
    }
    void chrome.runtime.sendMessage({
      type: "BC_RECORD_FILTERS",
      commentsBlocked,
      videosBlocked
    }).catch(() => void 0);
  }
  handleMessage = (message, _sender, sendResponse) => {
    if (!message || typeof message !== "object" || !("type" in message)) {
      return false;
    }
    switch (message.type) {
      case "BC_GET_PAGE_STATUS":
        sendResponse({ ok: true, status: this.getStatus() });
        return false;
      case "BC_SHOW_ALL_ON_PAGE":
        this.renderer.showAllTemporarily();
        sendResponse({ ok: true });
        return false;
      case "BC_RESCAN_PAGE":
        this.renderer.clearRevealed();
        this.adapter?.rescan();
        sendResponse({ ok: true });
        return false;
      default:
        return false;
    }
  };
  rebind() {
    this.adapter?.destroy();
    this.adapter = null;
    this.danmakuController = null;
    this.renderer.restoreAll(false);
    this.renderer.clearRevealed();
    if (!isCleaningActive(this.state.settings)) {
      return;
    }
    const page = matchSupportedPage(new URL(location.href));
    const context = {
      getState: () => this.state,
      renderer: this.renderer
    };
    if (page === "video") {
      const controller = new DanmakuController(() => this.state);
      this.danmakuController = controller;
      this.adapter = new VideoPageAdapter(context, controller);
    } else if (page === "home") {
      this.adapter = new HomeAdapter(context);
    } else if (page === "search") {
      this.adapter = new SearchAdapter(context);
    }
    this.adapter?.start();
  }
  schedulePauseWake() {
    if (this.pauseTimer !== null) {
      window.clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    const pausedUntil = this.state.settings.pausedUntil;
    if (pausedUntil !== null && pausedUntil > Date.now()) {
      const delay = Math.min(pausedUntil - Date.now() + 50, 2147e6);
      this.pauseTimer = window.setTimeout(() => this.rebind(), delay);
    }
  }
  getStatus() {
    const page = matchSupportedPage(new URL(location.href));
    const counts = this.renderer.getCounts();
    const inScope = page !== "unsupported";
    const danmaku = page === "video" ? this.danmakuController?.getStatus() ?? "unknown" : "not-applicable";
    return {
      inScope,
      enabled: inScope && isCleaningActive(this.state.settings),
      adapter: this.adapter?.name ?? (inScope ? "已暂停" : "当前页面暂不支持"),
      ...counts,
      danmaku,
      note: inScope ? void 0 : "MVP 0.1 支持视频页、首页和搜索页。"
    };
  }
};
var app = new BiliCleanApp();
void app.start();
