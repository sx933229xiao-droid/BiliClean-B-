// Recovered from BiliClean v0.1.4 distribution module: src/content/adapters/video-page-adapter.ts
import { SITE_SELECTORS } from "./selectors.js";
import { evaluateComment } from "../core/rule-engine.js";
import { queryAll, closestComposed } from "./dom-utils.js";
import { BaseAdapter } from "./base-adapter.js";
import { parseCommentElement } from "./entity-parsers.js";

export var INITIAL_COMMENT_BATCH_SIZE = 50;
export var INITIAL_COMMENT_BATCH_TIMEOUT_MS = 1200;
export var VideoPageAdapter = class extends BaseAdapter {
  name = "视频页";
  fingerprints = /* @__PURE__ */ new WeakMap();
  initialBatch = /* @__PURE__ */ new Set();
  initialBatchComplete = false;
  initialBatchTimer = null;
  danmakuController;
  constructor(context, danmakuController) {
    super(context);
    this.danmakuController = danmakuController;
  }
  start() {
    super.start();
    this.danmakuController.start();
  }
  destroy() {
    this.cancelInitialBatch();
    this.danmakuController.destroy();
    super.destroy();
  }
  rescan() {
    this.fingerprints = /* @__PURE__ */ new WeakMap();
    if (!this.initialBatchComplete) {
      this.flushInitialBatch();
    }
    super.rescan();
  }
  scan(root) {
    const state = this.context.getState();
    if (!state.settings.modules.comments) {
      return;
    }
    const candidates = new Set(queryAll(root, SITE_SELECTORS.commentItems));
    if (root instanceof ShadowRoot && SITE_SELECTORS.commentItems.some((selector) => root.host.matches(selector))) {
      candidates.add(root.host);
    }
    if (root instanceof Element) {
      const ancestor = closestComposed(root, SITE_SELECTORS.commentItems);
      if (ancestor) {
        candidates.add(ancestor);
      }
    }
    const boundaries = new Set([...candidates].map((element) => this.commentBoundary(element)));
    for (const element of boundaries) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }
      if (!this.initialBatchComplete) {
        if (!parseCommentElement(element)) {
          continue;
        }
        this.queueInitialComment(element);
        continue;
      }
      this.evaluateAndRender(element, state);
    }
  }
  queueInitialComment(element) {
    if (this.initialBatch.has(element)) {
      return;
    }
    this.initialBatch.add(element);
    this.context.renderer.stageComment(element);
    if (this.initialBatchTimer === null) {
      this.initialBatchTimer = window.setTimeout(
        () => this.flushInitialBatch(),
        INITIAL_COMMENT_BATCH_TIMEOUT_MS
      );
    }
    if (this.initialBatch.size >= INITIAL_COMMENT_BATCH_SIZE) {
      this.flushInitialBatch();
    }
  }
  flushInitialBatch() {
    if (this.initialBatchComplete) {
      return;
    }
    this.initialBatchComplete = true;
    if (this.initialBatchTimer !== null) {
      window.clearTimeout(this.initialBatchTimer);
      this.initialBatchTimer = null;
    }
    const state = this.context.getState();
    for (const element of this.initialBatch) {
      this.evaluateAndRender(element, state);
    }
    this.initialBatch.clear();
  }
  cancelInitialBatch() {
    if (this.initialBatchTimer !== null) {
      window.clearTimeout(this.initialBatchTimer);
      this.initialBatchTimer = null;
    }
    for (const element of this.initialBatch) {
      this.context.renderer.unstageComment(element);
    }
    this.initialBatch.clear();
  }
  evaluateAndRender(element, state = this.context.getState()) {
    const item = parseCommentElement(element);
    if (!item) {
      this.context.renderer.unstageComment(element);
      return;
    }
    const fingerprint = [
      item.text,
      item.hasAtMention ? "1" : "0",
      item.authorId ?? "",
      item.authorName ?? "",
      item.authorLevel ?? "",
      item.likeCount ?? "",
      item.publishTimestamp ?? "",
      item.replyDepth
    ].join("");
    if (this.fingerprints.get(element) === fingerprint) {
      this.context.renderer.unstageComment(element);
      return;
    }
    this.fingerprints.set(element, fingerprint);
    const result = evaluateComment(item, state);
    this.context.renderer.applyComment(item, result);
  }
  commentBoundary(element) {
    if (!element.matches("bili-comment-renderer")) {
      return element;
    }
    return closestComposed(
      element,
      ["bili-comment-reply-renderer", "bili-comment-thread-renderer"],
      false
    ) ?? element;
  }
};
