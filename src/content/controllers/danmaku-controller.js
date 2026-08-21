// Recovered from BiliClean v0.1.4 distribution module: src/content/controllers/danmaku-controller.ts
import { SITE_SELECTORS } from "../adapters/selectors.js";
import { closestAny, queryDeepFirst } from "../adapters/dom-utils.js";

export var DanmakuController = class {
  getState;
  retryTimer = null;
  verifyTimer = null;
  destroyed = false;
  attempt = 0;
  manualAllowedVideo = "";
  status = "unknown";
  isProgrammaticClose = false;
  mutationObserver = null;
  mutationDebounce = null;
  constructor(getState) {
    this.getState = getState;
  }
  start() {
    this.destroyed = false;
    this.attempt = 0;
    this.manualAllowedVideo = "";
    this.status = "unknown";
    this.isProgrammaticClose = false;
    document.addEventListener("click", this.handleTrustedClick, true);
    this.observeMutations();
    this.schedule(0);
  }
  destroy() {
    this.destroyed = true;
    document.removeEventListener("click", this.handleTrustedClick, true);
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.verifyTimer !== null) {
      window.clearTimeout(this.verifyTimer);
      this.verifyTimer = null;
    }
    if (this.mutationDebounce !== null) {
      window.clearTimeout(this.mutationDebounce);
      this.mutationDebounce = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }
  getStatus() {
    return this.status;
  }
  handleTrustedClick = (event) => {
    if (this.destroyed || !event.isTrusted || !(event.target instanceof Element)) {
      return;
    }
    const toggle = closestAny(event.target, SITE_SELECTORS.danmakuToggles);
    if (!toggle) {
      return;
    }
    window.setTimeout(() => {
      if (this.destroyed) {
        return;
      }
      const current = this.readToggle(toggle);
      if (current === true) {
        if (this.getState().settings.danmaku.allowManualEnableForCurrentVideo) {
          this.manualAllowedVideo = this.currentVideoKey();
          this.status = "open";
        } else if (!this.isProgrammaticClose) {
          this.status = "open";
          this.schedule(80);
        }
      } else if (current === false) {
        this.status = "closed";
      }
    }, 150);
  };
  observeMutations() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    this.mutationObserver = new MutationObserver(() => {
      if (this.mutationDebounce !== null) {
        return;
      }
      this.mutationDebounce = window.setTimeout(() => {
        this.mutationDebounce = null;
        this.handleMutationToggleCheck();
      }, 120);
    });
    const target = document.documentElement || document.body;
    if (target) {
      this.mutationObserver.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-checked", "data-checked", "class", "checked", "title", "aria-label"]
      });
    }
  }
  handleMutationToggleCheck() {
    if (this.destroyed) {
      return;
    }
    const settings = this.getState().settings;
    if (!settings.modules.danmaku || !settings.danmaku.defaultOff) {
      return;
    }
    if (this.manualAllowedVideo === this.currentVideoKey()) {
      return;
    }
    if (this.isProgrammaticClose) {
      return;
    }
    const toggle = queryDeepFirst(document, SITE_SELECTORS.danmakuToggles);
    if (!toggle) {
      if (this.status !== "not-found" && this.status !== "unknown") {
        this.status = "not-found";
        this.retry();
      }
      return;
    }
    const open = this.readToggle(toggle);
    if (open === true && !settings.danmaku.allowManualEnableForCurrentVideo) {
      this.status = "open";
      this.schedule(80);
    } else if (open === false) {
      this.status = "closed";
    }
  }
  schedule(delay) {
    if (this.destroyed) {
      return;
    }
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
    }
    this.retryTimer = window.setTimeout(() => this.tryClose(), delay);
  }
  tryClose() {
    if (this.destroyed) {
      return;
    }
    const settings = this.getState().settings;
    if (!settings.modules.danmaku || !settings.danmaku.defaultOff) {
      this.status = "not-applicable";
      return;
    }
    if (this.manualAllowedVideo === this.currentVideoKey()) {
      this.status = "open";
      return;
    }
    const toggle = queryDeepFirst(document, SITE_SELECTORS.danmakuToggles);
    if (!toggle) {
      this.status = "not-found";
      this.retry();
      return;
    }
    const open = this.readToggle(toggle);
    if (open === false) {
      this.status = "closed";
      return;
    }
    if (open === null) {
      this.status = "unknown";
      this.retry();
      return;
    }
    this.isProgrammaticClose = true;
    toggle.click();
    if (this.verifyTimer !== null) {
      window.clearTimeout(this.verifyTimer);
    }
    this.verifyTimer = window.setTimeout(() => {
      this.isProgrammaticClose = false;
      if (this.destroyed) {
        return;
      }
      const state = this.readToggle(toggle);
      if (state === false) {
        this.status = "closed";
      } else {
        this.status = state === true ? "open" : "unknown";
        if (state === true && !settings.danmaku.allowManualEnableForCurrentVideo) {
          this.retry();
        } else if (state !== false) {
          this.retry();
        }
      }
    }, 180);
  }
  retry() {
    const delays = [100, 250, 500, 1e3, 2e3, 3e3, 3e3];
    const delay = delays[this.attempt];
    this.attempt += 1;
    if (delay !== void 0) {
      this.schedule(delay);
    } else {
      this.schedule(3e3);
    }
  }
  readToggle(element) {
    const input = element instanceof HTMLInputElement ? element : element.querySelector('input[type="checkbox"]');
    if (input instanceof HTMLInputElement) {
      return input.checked;
    }
    const ariaChecked = element.getAttribute("aria-checked");
    if (ariaChecked === "true" || ariaChecked === "false") {
      return ariaChecked === "true";
    }
    const dataChecked = element.getAttribute("data-checked");
    if (dataChecked === "true" || dataChecked === "false") {
      return dataChecked === "true";
    }
    if (element.classList.contains("bui-checkbox-checked") || element.classList.contains("active") || element.classList.contains("on")) {
      return true;
    }
    if (element.classList.contains("bui-checkbox-unchecked") || element.classList.contains("closed") || element.classList.contains("off")) {
      return false;
    }
    return null;
  }
  currentVideoKey() {
    return `${location.pathname}${location.search}`;
  }
};
