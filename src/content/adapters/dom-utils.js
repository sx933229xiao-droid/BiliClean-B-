// Recovered from BiliClean v0.1.4 distribution module: src/content/adapters/dom-utils.ts
export function queryAll(root, selectors) {
  const results = /* @__PURE__ */ new Set();
  if (root instanceof Element && selectors.some((selector) => root.matches(selector))) {
    results.add(root);
  }
  for (const selector of selectors) {
    root.querySelectorAll(selector).forEach((element) => results.add(element));
  }
  return [...results];
}
export function queryFirst(root, selectors) {
  if (root instanceof Element && selectors.some((selector) => root.matches(selector))) {
    return root;
  }
  for (const selector of selectors) {
    const found = root.querySelector(selector);
    if (found) {
      return found;
    }
  }
  return null;
}
export function closestAny(element, selectors) {
  for (const selector of selectors) {
    const found = element.closest(selector);
    if (found) {
      return found;
    }
  }
  return null;
}
export function collectOpenShadowRoots(root) {
  const roots = [];
  const elements = root instanceof Element ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
  for (const element of elements) {
    if (element.shadowRoot) {
      roots.push(element.shadowRoot);
      roots.push(...collectOpenShadowRoots(element.shadowRoot));
    }
  }
  return roots;
}
export function queryDeepFirst(root, selectors) {
  const direct = queryFirst(root, selectors);
  if (direct) {
    return direct;
  }
  for (const shadowRoot of collectOpenShadowRoots(root)) {
    const found = queryFirst(shadowRoot, selectors);
    if (found) {
      return found;
    }
  }
  return null;
}
export function queryDeepAll(root, selectors) {
  const results = new Set(queryAll(root, selectors));
  for (const shadowRoot of collectOpenShadowRoots(root)) {
    queryAll(shadowRoot, selectors).forEach((element) => results.add(element));
  }
  return [...results];
}
export function composedParent(element) {
  if (element.parentElement) {
    return element.parentElement;
  }
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}
export function closestComposed(element, selectors, includeSelf = true) {
  let current = includeSelf ? element : composedParent(element);
  while (current) {
    if (selectors.some((selector) => current?.matches(selector))) {
      return current;
    }
    current = composedParent(current);
  }
  return null;
}
export function outermostComposedMatch(element, selectors) {
  let current = element;
  let outermost = null;
  while (current) {
    if (selectors.some((selector) => current?.matches(selector))) {
      outermost = current;
    }
    current = composedParent(current);
  }
  return outermost;
}
export function parseCompactNumber(value) {
  const normalized = value.replace(/[,，\s]/gu, "");
  const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*(万|亿|k|w)?/iu);
  if (!match?.[1]) {
    return void 0;
  }
  const number = Number(match[1]);
  if (!Number.isFinite(number)) {
    return void 0;
  }
  const suffix = match[2]?.toLocaleLowerCase();
  const multiplier = suffix === "亿" ? 1e8 : suffix === "万" || suffix === "w" ? 1e4 : suffix === "k" ? 1e3 : 1;
  return Math.round(number * multiplier);
}
export function parseRelativeTimestamp(value, now = Date.now()) {
  const text = value.trim();
  if (!text) {
    return void 0;
  }
  if (/刚刚|片刻前/u.test(text)) {
    return now;
  }
  const relative = text.match(/(\d+)\s*(分钟|小时|天|周|个月|年)前/u);
  if (relative?.[1] && relative[2]) {
    const amount = Number(relative[1]);
    const unitMs = {
      分钟: 6e4,
      小时: 36e5,
      天: 864e5,
      周: 6048e5,
      个月: 2592e6,
      年: 31536e6
    };
    return now - amount * (unitMs[relative[2]] ?? 0);
  }
  const dateMatch = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/u);
  if (dateMatch?.[1] && dateMatch[2] && dateMatch[3]) {
    const parsed = new Date(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3])
    ).getTime();
    return Number.isFinite(parsed) ? parsed : void 0;
  }
  return void 0;
}
export function extractSpaceId(href) {
  if (!href) {
    return void 0;
  }
  const match = href.match(/space\.bilibili\.com\/(\d+)/u) ?? href.match(/\/space\/(\d+)/u);
  return match?.[1];
}
export function stableElementId(element, prefix) {
  const known = element.getAttribute("data-reply-id") ?? element.getAttribute("data-rpid") ?? element.getAttribute("data-bvid") ?? element.id;
  if (known) {
    return known;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
