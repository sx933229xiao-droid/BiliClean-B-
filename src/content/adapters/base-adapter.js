// Recovered from BiliClean v0.1.4 distribution module: src/content/adapters/base-adapter.ts
import { collectOpenShadowRoots } from "./dom-utils.js";

export var BaseAdapter = class {
  context;
  observers = [];
  observedRoots = /* @__PURE__ */ new WeakSet();
  pending = /* @__PURE__ */ new Set();
  frameId = null;
  destroyed = false;
  constructor(context) {
    this.context = context;
  }
  start() {
    this.destroyed = false;
    this.observeRoot(document);
    this.scan(document);
    this.observeDiscoveredShadows(document);
  }
  destroy() {
    this.destroyed = true;
    for (const observer of this.observers) {
      observer.disconnect();
    }
    this.observers.length = 0;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.pending.clear();
  }
  rescan() {
    if (!this.destroyed) {
      this.scan(document);
      this.observeDiscoveredShadows(document);
    }
  }
  observeRoot(root) {
    const target = root instanceof Document ? root.documentElement : root;
    if (!target || this.observedRoots.has(target)) {
      return;
    }
    this.observedRoots.add(target);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "childList") {
          for (const node of record.addedNodes) {
            const element = node instanceof Element ? node : node.parentElement;
            if (element) {
              this.pending.add(element);
            }
          }
        } else {
          const element = record.target instanceof Element ? record.target : record.target.parentElement;
          if (element) {
            this.pending.add(element);
          }
        }
      }
      this.scheduleFlush();
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "aria-label",
        "data-count",
        "data-like-count",
        "data-view-count",
        "data-play-count",
        "data-play",
        "data-duration",
        "data-duration-seconds",
        "data-time",
        "data-timestamp",
        "data-user-level",
        "datetime",
        "title"
      ]
    });
    this.observers.push(observer);
  }
  scheduleFlush() {
    if (this.frameId !== null || this.destroyed) {
      return;
    }
    const schedule = window.requestAnimationFrame ?? ((callback) => {
      return window.setTimeout(() => callback(performance.now()), 16);
    });
    this.frameId = schedule(() => {
      this.frameId = null;
      const items = [...this.pending];
      this.pending.clear();
      for (const element of items) {
        this.scan(element);
        this.observeDiscoveredShadows(element);
      }
    });
  }
  observeDiscoveredShadows(root) {
    for (const shadowRoot of collectOpenShadowRoots(root)) {
      this.observeRoot(shadowRoot);
      this.scan(shadowRoot);
    }
  }
};
