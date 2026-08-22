// Recovered from BiliClean v0.1.4 distribution module: src/content/adapters/search-adapter.ts
import { SITE_SELECTORS } from "./selectors.js";
import { VideoCardAdapter } from "./video-card-adapter.js";
import { queryAll } from "./dom-utils.js";

export var SearchAdapter = class extends VideoCardAdapter {
  name = "搜索页";
  source = "search";
  cardSelectors = SITE_SELECTORS.searchVideoCards;
  replenishTimer = null;
  replenishAttempts = 0;
  lastFilteredCount = 0;
  MAX_REPLENISH = 3;
  MIN_VISIBLE = 15;
  DEBOUNCE_MS = 650;
  FOLLOWUP_MS = 1600;

  destroy() {
    if (this.replenishTimer !== null) {
      try {
        window.clearTimeout(this.replenishTimer);
      } catch {}
      this.replenishTimer = null;
    }
    this.replenishAttempts = 0;
    super.destroy();
  }

  rescan() {
    if (this.replenishTimer !== null) {
      try {
        window.clearTimeout(this.replenishTimer);
      } catch {}
      this.replenishTimer = null;
    }
    this.replenishAttempts = 0;
    try {
      this.lastFilteredCount = this.context.renderer.getCounts().videosFiltered;
    } catch {}
    super.rescan();
  }

  scan(root) {
    let beforeFiltered = 0;
    try {
      beforeFiltered = this.context.renderer.getCounts().videosFiltered;
    } catch {}
    super.scan(root);
    let afterFiltered = beforeFiltered;
    try {
      afterFiltered = this.context.renderer.getCounts().videosFiltered;
    } catch {}
    const delta = afterFiltered - beforeFiltered;
    // 仅在搜索页且本轮有新增过滤时才考虑补齐，避免无过滤时的无意义触发
    if (delta > 0) {
      this.lastFilteredCount = afterFiltered;
      this.scheduleReplenishCheck();
    }
  }

  getVisibleCount() {
    try {
      return queryAll(document, this.cardSelectors).length;
    } catch {
      return 0;
    }
  }

  scheduleReplenishCheck() {
    if (this.destroyed) return;
    try {
      const state = this.context.getState();
      if (!this.shouldRun(state)) return;
    } catch {
      return;
    }
    if (this.replenishTimer !== null) return;
    if (this.replenishAttempts >= this.MAX_REPLENISH) return;
    this.replenishTimer = window.setTimeout(() => {
      this.replenishTimer = null;
      this.evaluateReplenish();
    }, this.DEBOUNCE_MS);
  }

  evaluateReplenish() {
    if (this.destroyed) return;
    let state;
    try {
      state = this.context.getState();
    } catch {
      return;
    }
    if (!this.shouldRun(state)) return;
    if (this.replenishAttempts >= this.MAX_REPLENISH) return;
    let visible = 0;
    try {
      visible = this.getVisibleCount();
    } catch {
      visible = 0;
    }
    // 可见数充足则重置计数，不触发
    if (visible >= this.MIN_VISIBLE) {
      this.replenishAttempts = 0;
      return;
    }
    // 可见数不足且近期有过滤，触发一次轻量滚动以唤醒 B 站的触底加载
    this.replenishAttempts += 1;
    this.triggerReplenish();
    // 预约复检：等待 B 站异步追加新节点后再评估是否需二次补齐
    if (this.replenishAttempts < this.MAX_REPLENISH) {
      this.replenishTimer = window.setTimeout(() => {
        this.replenishTimer = null;
        this.scheduleReplenishCheck();
      }, this.FOLLOWUP_MS);
    }
  }

  triggerReplenish() {
    try {
      window.dispatchEvent(new Event("scroll", { bubbles: true }));
      // 轻微位移触发 IntersectionObserver/ scroll 监听，立即回弹避免抖动
      try {
        window.scrollBy(0, 1);
        window.scrollBy(0, -1);
      } catch {}
      // 同时尝试对搜索容器派发 scroll，兼容容器滚动模式
      for (const sel of SITE_SELECTORS.feedContainers) {
        try {
          const nodes = document.querySelectorAll(sel);
          for (const el of nodes) {
            el.dispatchEvent(new Event("scroll", { bubbles: true }));
            if (el.scrollHeight > el.clientHeight) {
              const top = el.scrollTop;
              // 轻触 scrollTop 以触发监听
              try {
                el.scrollTop = Math.min(top + 1, el.scrollHeight - el.clientHeight);
                el.scrollTop = top;
              } catch {}
            }
          }
        } catch {}
      }
    } catch {}
  }
};
