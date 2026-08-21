import test from "node:test";
import assert from "node:assert/strict";

function createMockElement(tag, className = "", attrs = {}) {
  const el = {
    tagName: tag.toUpperCase(),
    className,
    _attrs: new Map(Object.entries(attrs)),
    children: [],
    parentElement: null,
    style: {
      _vals: new Map(),
      getPropertyValue(k) { return this._vals.get(k)?.value || ""; },
      getPropertyPriority(k) { return this._vals.get(k)?.priority || ""; },
      setProperty(k, v, p) { this._vals.set(k, { value: v, priority: p }); },
      removeProperty(k) { this._vals.delete(k); }
    },
    classList: {
      _s: new Set(className.split(" ").filter(Boolean)),
      add(...a) { a.forEach((x) => this._s.add(x)); },
      remove(...a) { a.forEach((x) => this._s.delete(x)); },
      contains(x) { return this._s.has(x); }
    },
    dataset: {},
    shadowRoot: null,
    getAttribute(name) { return this._attrs.get(name) || null; },
    setAttribute(name, value) { this._attrs.set(name, value); },
    matches(sel) {
      sel = sel.trim();
      if (sel.startsWith(".")) {
        if (sel.includes(".")) {
          const parts = sel.split(".").filter(Boolean);
          return parts.every((p) => {
            const base = p.split("[")[0].split(":")[0];
            return this.className.split(/\s+/).includes(base);
          });
        }
        const cls = sel.slice(1).split("[")[0].split(":")[0];
        if (cls.includes("*")) return false;
        return this.className.split(/\s+/).includes(cls);
      }
      if (sel.startsWith("[data-bvid]")) return this._attrs.has("data-bvid");
      if (sel === "#i_cecream" || sel === "body" || sel === "html" || sel === "main") {
        return this.tagName.toLowerCase() === sel.replace("#", "") || this.className.includes(sel.replace("#", ""));
      }
      return false;
    },
    closest(sel) {
      let cur = this;
      while (cur) {
        if (cur.matches(sel)) return cur;
        cur = cur.parentElement || (cur.getRootNode && cur.getRootNode().host) || null;
      }
      return null;
    },
    contains(other) {
      let cur = other;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentElement;
      }
      return false;
    },
    querySelector(sel) {
      const all = this.querySelectorAll(sel);
      return all[0] || null;
    },
    querySelectorAll(sel) {
      const results = [];
      const selList = typeof sel === "string" && sel.includes(",") ? sel.split(",").map((s) => s.trim()) : [sel];
      function walk(node) {
        for (const child of node.children) {
          for (const s of selList) {
            if (child.matches(s)) results.push(child);
          }
          walk(child);
        }
      }
      walk(this);
      return results;
    },
    getRootNode() { return { host: null }; }
  };
  Object.defineProperty(el, "nextSibling", {
    get() {
      if (!this.parentElement) return null;
      const idx = this.parentElement.children.indexOf(this);
      return this.parentElement.children[idx + 1] || null;
    }
  });
  el.appendChild = (child) => {
    if (child.parentElement) {
      const oldIdx = child.parentElement.children.indexOf(child);
      if (oldIdx !== -1) child.parentElement.children.splice(oldIdx, 1);
    }
    child.parentElement = el;
    el.children.push(child);
  };
  el.removeChild = (child) => {
    const idx = el.children.indexOf(child);
    if (idx !== -1) {
      el.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  };
  el.insertBefore = (newNode, refNode) => {
    if (newNode.parentElement) {
      const oldIdx = newNode.parentElement.children.indexOf(newNode);
      if (oldIdx !== -1) newNode.parentElement.children.splice(oldIdx, 1);
    }
    if (!refNode) {
      newNode.parentElement = el;
      el.children.push(newNode);
      return newNode;
    }
    const idx = el.children.indexOf(refNode);
    if (idx !== -1) {
      el.children.splice(idx, 0, newNode);
      newNode.parentElement = el;
    } else {
      newNode.parentElement = el;
      el.children.push(newNode);
    }
    return newNode;
  };
  el.remove = function () {
    if (this.parentElement) this.parentElement.removeChild(this);
  };
  return el;
}

function buildHomeGrid() {
  const app = createMockElement("div", "", { id: "i_cecream" });
  app.matches = (sel) => sel === "#i_cecream";
  const biliFeed4 = createMockElement("div", "bili-feed4");
  app.appendChild(biliFeed4);
  const layout = createMockElement("main", "bili-feed4-layout");
  biliFeed4.appendChild(layout);
  const container = createMockElement("div", "container is-version8");
  layout.appendChild(container);
  const cards = [];
  for (let i = 0; i < 5; i++) {
    const feedCard = createMockElement("div", "bili-feed-card");
    container.appendChild(feedCard);
    const videoCard = createMockElement("div", "bili-video-card");
    feedCard.appendChild(videoCard);
    const titleWrap = createMockElement("div", "bili-video-card__info--tit");
    titleWrap.textContent = `视频标题${i}`;
    videoCard.appendChild(titleWrap);
    Object.defineProperty(videoCard, "textContent", { get() { return titleWrap.textContent; } });
    cards.push({ feedCard, videoCard, titleWrap, container, layout });
  }
  const directCard = createMockElement("div", "bili-video-card");
  container.appendChild(directCard);
  const directTitle = createMockElement("div", "bili-video-card__info--tit");
  directTitle.textContent = "直接卡片";
  directCard.appendChild(directTitle);
  return { app, container, layout, biliFeed4, cards, directCard };
}

test("首页布局单元应为直接挂在 feed 容器下的那一层（避免空白）", async () => {
  const originalElement = globalThis.Element;
  const originalShadowRoot = globalThis.ShadowRoot;
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.Element = class Element {};
  globalThis.ShadowRoot = class ShadowRoot {};
  globalThis.window = globalThis;
  globalThis.document = {
    documentElement: createMockElement("html", ""),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {}
  };
  if (!globalThis.window.requestAnimationFrame) globalThis.window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  if (!globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

  try {
    const { VideoCardAdapter } = await import(`../src/content/adapters/video-card-adapter.js?layout=${Date.now()}`);
    const { FilterRenderer } = await import(`../src/content/renderers/filter-renderer.js?layout=${Date.now()}`);

    const { container, cards } = buildHomeGrid();
    const mockRenderer = new FilterRenderer(() => {});
    const context = { getState: () => ({ settings: { modules: { videos: true }, videos: { homeEnabled: true, searchEnabled: true, lowViewEnabled: false, shortDurationEnabled: false, minViewCount: 50000, minDurationSeconds: 60 } } }), renderer: mockRenderer };
    const adapter = new VideoCardAdapter(context, { start() {}, destroy() {} });
    adapter.cardSelectors = (await import("../src/content/adapters/selectors.js")).SITE_SELECTORS.homeVideoCards;

    const inner = cards[0].videoCard;
    const layoutItem = adapter.resolveLayoutItem(inner);
    assert.equal(layoutItem, cards[0].feedCard, "内层 bili-video-card 应解析到外层 bili-feed-card 布局单元");

    const directLayout = adapter.resolveLayoutItem(cards[0].feedCard);
    assert.equal(directLayout, cards[0].feedCard);

    // 隐藏一个视频后应从 DOM 移除（避免 nth-of-type 仍计数导致行距异常），后续卡片自动补位
    const fakeCard = { element: layoutItem, title: "测试", source: "home" };
    assert.equal(container.children.includes(layoutItem), true);
    mockRenderer.applyVideoCard(fakeCard, { action: "hide", reasons: [] });
    assert.equal(container.children.includes(layoutItem), false, "布局单元应从容器中移除以避免空位和行距异常");
    assert.equal(inner.parentElement, layoutItem, "内层仍在被移除的格子内，不应单独隐藏");

    // 恢复后应放回原位
    mockRenderer.showAllTemporarily();
    assert.equal(container.children.includes(layoutItem), true, "恢复后应重新挂载");
    assert.equal(container.children.indexOf(layoutItem), 0, "恢复后顺序应保持");

    // 重扫后再次隐藏且再次补位
    mockRenderer.clearRevealed();
    mockRenderer.applyVideoCard(fakeCard, { action: "hide", reasons: [] });
    assert.equal(container.children.includes(layoutItem), false);

    // 连续隐藏多个不应影响未命中卡片
    const secondLayout = cards[1].feedCard;
    const secondCard = { element: secondLayout, title: "测试2", source: "home" };
    mockRenderer.applyVideoCard(secondCard, { action: "hide", reasons: [] });
    assert.equal(container.children.includes(secondLayout), false);
    assert.equal(container.children.includes(cards[2].feedCard), true, "未命中的卡片应保持可见且不被移动");
    assert.equal(cards[2].feedCard.parentElement, container);

    // 验证顺序：剩余可见卡片仍按原序排列
    const visible = container.children.filter((c) => c.className.includes("bili-feed-card"));
    assert.equal(visible[0], cards[2].feedCard);
    assert.equal(visible[1], cards[3].feedCard);
  } finally {
    globalThis.Element = originalElement;
    globalThis.ShadowRoot = originalShadowRoot;
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("搜索页布局单元解析同样生效", async () => {
  const originalElement = globalThis.Element;
  const originalShadowRoot = globalThis.ShadowRoot;
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.Element = class Element {};
  globalThis.ShadowRoot = class ShadowRoot {};
  globalThis.window = globalThis;
  globalThis.document = {
    documentElement: createMockElement("html", ""),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {}
  };
  if (!globalThis.window.requestAnimationFrame) globalThis.window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  try {
    const { SearchAdapter } = await import(`../src/content/adapters/search-adapter.js?search=${Date.now()}`);
    const { FilterRenderer } = await import(`../src/content/renderers/filter-renderer.js?search=${Date.now()}`);
    const mockRenderer = new FilterRenderer(() => {});
    const context = { getState: () => ({ settings: { modules: { videos: true }, videos: { homeEnabled: true, searchEnabled: true, lowViewEnabled: false, shortDurationEnabled: false } } }), renderer: mockRenderer };
    const adapter = new SearchAdapter(context);
    const videoList = createMockElement("div", "video-list");
    const videoItem = createMockElement("div", "video-item");
    videoList.appendChild(videoItem);
    const biliCard = createMockElement("div", "bili-video-card");
    videoItem.appendChild(biliCard);
    const title = createMockElement("div", "title");
    title.textContent = "搜索视频";
    biliCard.appendChild(title);

    adapter.cardSelectors = (await import("../src/content/adapters/selectors.js")).SITE_SELECTORS.searchVideoCards;
    const layoutItem = adapter.resolveLayoutItem(biliCard);
    assert.equal(layoutItem, videoItem, "搜索页内层卡片应解析到外层 video-item 布局单元");

    const fakeCard = { element: layoutItem, title: "搜索视频", source: "search" };
    mockRenderer.applyVideoCard(fakeCard, { action: "hide", reasons: [] });
    assert.equal(videoList.children.includes(videoItem), false, "搜索页隐藏也应从 DOM 移除以避免空位");
    mockRenderer.showAllTemporarily();
    assert.equal(videoList.children.includes(videoItem), true);
  } finally {
    globalThis.Element = originalElement;
    globalThis.ShadowRoot = originalShadowRoot;
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("不同卡片类型（广告/直播）不应被误隐藏整行", async () => {
  const originalElement = globalThis.Element;
  const originalShadowRoot = globalThis.ShadowRoot;
  globalThis.Element = class Element {};
  globalThis.ShadowRoot = class ShadowRoot {};
  globalThis.window = globalThis;
  globalThis.document = {
    documentElement: createMockElement("html", ""),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {}
  };
  if (!globalThis.window.requestAnimationFrame) globalThis.window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  try {
    const { VideoCardAdapter } = await import(`../src/content/adapters/video-card-adapter.js?ad=${Date.now()}`);
    const { FilterRenderer } = await import(`../src/content/renderers/filter-renderer.js?ad=${Date.now()}`);
    const mockRenderer = new FilterRenderer(() => {});
    const context = { getState: () => ({ settings: { modules: { videos: true }, videos: { homeEnabled: true, searchEnabled: true, lowViewEnabled: false, shortDurationEnabled: false } } }), renderer: mockRenderer };
    const adapter = new VideoCardAdapter(context, { start() {}, destroy() {} });
    adapter.cardSelectors = (await import("../src/content/adapters/selectors.js")).SITE_SELECTORS.homeVideoCards;

    const { container, cards } = buildHomeGrid();
    const adFeedCard = createMockElement("div", "bili-feed-card");
    container.appendChild(adFeedCard);
    const adInner = createMockElement("div", "ad-card");
    adFeedCard.appendChild(adInner);

    const normalLayout = cards[0].feedCard;
    const fakeCard = { element: normalLayout, title: "正常", source: "home" };
    mockRenderer.applyVideoCard(fakeCard, { action: "hide", reasons: [] });
    assert.equal(container.children.includes(normalLayout), false);
    assert.equal(container.children.includes(adFeedCard), true, "未命中的广告卡片不应被隐藏");
    assert.equal(container.children.includes(cards[1].feedCard), true);
  } finally {
    globalThis.Element = originalElement;
    globalThis.ShadowRoot = originalShadowRoot;
    globalThis.document = globalThis.document;
  }
});

test("移除后 nth-of-type 计数应不再包含已隐藏卡片（行距回归正常）", async () => {
  const originalElement = globalThis.Element;
  const originalShadowRoot = globalThis.ShadowRoot;
  globalThis.Element = class Element {};
  globalThis.ShadowRoot = class ShadowRoot {};
  globalThis.window = globalThis;
  globalThis.document = {
    documentElement: createMockElement("html", ""),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {}
  };
  if (!globalThis.window.requestAnimationFrame) globalThis.window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  try {
    const { FilterRenderer } = await import(`../src/content/renderers/filter-renderer.js?gap=${Date.now()}`);
    const mockRenderer = new FilterRenderer(() => {});
    const { container, cards } = buildHomeGrid();
    // 初始 6 个直接子节点（5 包装 + 1 直接）
    assert.equal(container.children.length, 6);
    // 隐藏 2 个
    mockRenderer.applyVideoCard({ element: cards[0].feedCard, title: "a", source: "home" }, { action: "hide", reasons: [] });
    mockRenderer.applyVideoCard({ element: cards[1].feedCard, title: "b", source: "home" }, { action: "hide", reasons: [] });
    assert.equal(container.children.length, 4, "隐藏后容器子节点数应减少，后续卡片自动补位且不会被 nth-of-type 误计行距");
    // 模拟 B 站 CSS 的 nth-of-type 逻辑：统计第 8 个起加 margin，若仍计数隐藏元素则会多算
    // 由于隐藏元素已不在 children 中，后续卡片的视觉序号与 DOM 序号一致，行距保持原生
    mockRenderer.showAllTemporarily();
    assert.equal(container.children.length, 6);
    mockRenderer.clearRevealed();
    mockRenderer.applyVideoCard({ element: cards[0].feedCard, title: "a", source: "home" }, { action: "hide", reasons: [] });
    assert.equal(container.children.length, 5);
  } finally {
    globalThis.Element = originalElement;
    globalThis.ShadowRoot = originalShadowRoot;
  }
});
