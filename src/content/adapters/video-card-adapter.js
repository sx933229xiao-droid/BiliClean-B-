// Recovered from BiliClean v0.1.4 distribution module: src/content/adapters/video-card-adapter.ts
import { evaluateVideoCard } from "../core/rule-engine.js";
import { queryAll, outermostComposedMatch, composedParent } from "./dom-utils.js";
import { SITE_SELECTORS } from "./selectors.js";
import { BaseAdapter } from "./base-adapter.js";
import { parseVideoCardElement } from "./entity-parsers.js";

export var VideoCardAdapter = class extends BaseAdapter {
  fingerprints = /* @__PURE__ */ new WeakMap();
  constructor(context) {
    super(context);
  }
  rescan() {
    this.fingerprints = /* @__PURE__ */ new WeakMap();
    super.rescan();
  }
  resolveLayoutItem(startElement) {
    const outermost = outermostComposedMatch(startElement, this.cardSelectors) ?? startElement;
    // 优先寻找“直接挂在 feed 容器下的那一层”——它才是 Grid/Flex 的布局单元
    let current = startElement;
    let candidate = outermost;
    const isFeedContainer = (el) => {
      if (!(el instanceof Element)) return false;
      return SITE_SELECTORS.feedContainers.some((sel) => {
        try {
          return el.matches(sel);
        } catch {
          return false;
        }
      });
    };
    // 从原始元素向上，找到离 feed 容器最近的直接子节点
    let node = startElement;
    while (node) {
      const parent = composedParent(node);
      if (!parent) break;
      if (isFeedContainer(parent)) {
        return node;
      }
      // 同时记录最外层的卡片匹配，作为兜底
      if (node instanceof Element && this.cardSelectors.some((sel) => {
        try { return node.matches(sel); } catch { return false; }
      })) {
        candidate = node;
      }
      node = parent;
      if (node instanceof Element && node.matches("#i_cecream, body, html")) break;
    }
    // 若没找到直接子节点，尝试从 outermost 向上再探一层包装
    let cur2 = outermost;
    while (cur2) {
      const parent = composedParent(cur2);
      if (!parent) break;
      if (isFeedContainer(parent)) {
        return cur2;
      }
      const grandParent = composedParent(parent);
      if (grandParent && isFeedContainer(grandParent)) {
        // parent 本身是未被卡片选择器命中的包装层，但它是布局单元
        if (parent.contains(startElement)) {
          return parent;
        }
      }
      cur2 = parent;
      if (cur2 instanceof Element && cur2.matches("#i_cecream, body, html")) break;
    }
    return candidate;
  }
  scan(root) {
    const state = this.context.getState();
    if (!this.shouldRun(state)) {
      return;
    }
    const discovered = new Set(queryAll(root, this.cardSelectors));
    if (root instanceof Element) {
      const ancestor = outermostComposedMatch(root, this.cardSelectors);
      if (ancestor) {
        discovered.add(ancestor);
      }
    }
    const layoutSet = new Set();
    const parseMap = new Map();
    for (const element of discovered) {
      const layoutItem = this.resolveLayoutItem(element);
      if (layoutSet.has(layoutItem)) continue;
      layoutSet.add(layoutItem);
      // 解析仍在最外层卡片上（能稳定取到标题等字段），若解析失败则回退到 layoutItem 自身
      const outermost = outermostComposedMatch(element, this.cardSelectors) ?? element;
      let card = parseVideoCardElement(outermost, this.source);
      if (!card) {
        card = parseVideoCardElement(layoutItem, this.source);
      }
      if (!card) {
        continue;
      }
      // 将真正需要隐藏的布局单元替换为 card.element，renderer 会对该元素做 display:none
      card.element = layoutItem;
      parseMap.set(layoutItem, card);
    }
    for (const [layoutItem, card] of parseMap) {
      const fingerprint = [
        card.title,
        card.uploaderId ?? "",
        card.uploaderName ?? "",
        card.viewCount ?? "",
        card.durationSeconds ?? ""
      ].join("");
      if (this.fingerprints.get(layoutItem) === fingerprint) {
        continue;
      }
      this.fingerprints.set(layoutItem, fingerprint);
      const result = evaluateVideoCard(card, state);
      this.context.renderer.applyVideoCard(card, result);
    }
  }
  shouldRun(state) {
    if (!state.settings.modules.videos) {
      return false;
    }
    return this.source === "home" ? state.settings.videos.homeEnabled : state.settings.videos.searchEnabled;
  }
};
