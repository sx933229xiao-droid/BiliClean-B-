// Recovered from BiliClean v0.1.4 distribution module: src/content/adapters/entity-parsers.ts
import { SITE_SELECTORS } from "./selectors.js";
import { normalizeText } from "../core/normalizer.js";
import { queryDeepFirst, queryDeepAll, parseCompactNumber, parseRelativeTimestamp, extractSpaceId, stableElementId } from "./dom-utils.js";

export function textOf(root, selectors) {
  for (const element of queryDeepAll(root, selectors)) {
    const text = element.textContent?.trim() ?? "";
    if (text) {
      return text;
    }
  }
  return "";
}
export function attributeNumber(elements, names) {
  for (const element of elements) {
    for (const name of names) {
      const value = element.getAttribute(name);
      const parsed = value ? parseCompactNumber(value) : void 0;
      if (parsed !== void 0) {
        return parsed;
      }
    }
  }
  return void 0;
}
export function parseLikeCount(root) {
  const elements = queryDeepAll(root, SITE_SELECTORS.commentLikes);
  const fromAttribute = attributeNumber(
    elements,
    ["data-like-count", "data-count", "aria-label", "title"]
  );
  if (fromAttribute !== void 0) {
    return fromAttribute;
  }
  for (const element of elements) {
    const parsed = parseCompactNumber(element.textContent ?? "");
    if (parsed !== void 0) {
      return parsed;
    }
  }
  return elements.length > 0 ? 0 : void 0;
}
export function parseTimestampValue(value) {
  const text = value.trim();
  if (/^\d{10,13}$/u.test(text)) {
    const numeric = Number(text);
    const milliseconds = text.length === 10 ? numeric * 1e3 : numeric;
    return Number.isFinite(milliseconds) ? milliseconds : void 0;
  }
  return parseRelativeTimestamp(text);
}
export function parsePublishTimestamp(root) {
  const elements = queryDeepAll(root, SITE_SELECTORS.commentTime);
  for (const element of elements) {
    const candidates = [
      element.getAttribute("datetime"),
      element.getAttribute("data-time"),
      element.getAttribute("data-timestamp"),
      element.getAttribute("title"),
      element.textContent
    ];
    for (const candidate of candidates) {
      const parsed = candidate ? parseTimestampValue(candidate) : void 0;
      if (parsed !== void 0) {
        return parsed;
      }
    }
  }
  return void 0;
}
export function parseDurationValue(value) {
  const text = value.trim();
  if (!text) {
    return void 0;
  }
  if (/^\d+(?:\.\d+)?$/u.test(text)) {
    const seconds = Number(text);
    return Number.isFinite(seconds) ? Math.round(seconds) : void 0;
  }
  const match = text.match(/(?:^|\s)(\d{1,3}):(\d{2})(?::(\d{2}))?(?:\s|$)/u);
  if (!match?.[1] || !match[2]) {
    return void 0;
  }
  const parts = match[3] ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, Number(match[1]), Number(match[2])];
  if (parts.some((part) => !Number.isFinite(part)) || parts[1] >= 60 || parts[2] >= 60) {
    return void 0;
  }
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
export function parseVideoViewCount(root) {
  const elements = queryDeepAll(root, SITE_SELECTORS.videoViews);
  const fromAttribute = attributeNumber(
    elements,
    ["data-view-count", "data-play-count", "data-play", "aria-label", "title"]
  );
  if (fromAttribute !== void 0) {
    return fromAttribute;
  }
  for (const element of elements) {
    const parsed = parseCompactNumber(element.textContent ?? "");
    if (parsed !== void 0) {
      return parsed;
    }
  }
  return void 0;
}
export function parseVideoDuration(root) {
  const elements = queryDeepAll(root, SITE_SELECTORS.videoDuration);
  for (const element of elements) {
    const candidates = [
      element.getAttribute("data-duration-seconds"),
      element.getAttribute("data-duration"),
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.textContent
    ];
    for (const candidate of candidates) {
      const parsed = candidate ? parseDurationValue(candidate) : void 0;
      if (parsed !== void 0) {
        return parsed;
      }
    }
  }
  return void 0;
}
export function parseCommentElement(element) {
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  const contentRoot = element.shadowRoot ?? element;
  const textElement = queryDeepFirst(contentRoot, SITE_SELECTORS.commentText);
  const text = textElement?.textContent?.trim() || textOf(contentRoot, SITE_SELECTORS.commentText);
  if (!text) {
    return null;
  }
  const authorElement = queryDeepFirst(contentRoot, SITE_SELECTORS.commentAuthor);
  const authorLink = queryDeepFirst(contentRoot, SITE_SELECTORS.commentAuthorLink);
  const levelElements = queryDeepAll(contentRoot, SITE_SELECTORS.commentLevel);
  const level = attributeNumber(
    levelElements,
    ["data-user-level", "alt", "title", "aria-label"]
  ) ?? levelElements.map((candidate) => parseCompactNumber(candidate.textContent ?? "")).find((candidate) => candidate !== void 0);
  const authorId = element.getAttribute("data-user-id") ?? element.getAttribute("data-mid") ?? extractSpaceId(authorLink?.getAttribute("href") ?? null);
  return {
    id: stableElementId(element, "comment"),
    source: "video",
    text,
    normalizedText: normalizeText(text),
    hasAtMention: /(?:@|＠)[^\s@＠]+/u.test(text) || Boolean(textElement && queryDeepFirst(textElement, SITE_SELECTORS.commentMentions)),
    authorId: authorId || void 0,
    authorName: authorElement?.textContent?.trim() || void 0,
    authorLevel: level !== void 0 && level >= 0 && level <= 6 ? level : void 0,
    likeCount: parseLikeCount(contentRoot),
    publishTimestamp: parsePublishTimestamp(contentRoot),
    replyDepth: SITE_SELECTORS.subCommentItems.some((selector) => element.matches(selector)) ? 1 : 0,
    imageUrls: queryDeepAll(contentRoot, SITE_SELECTORS.commentImages).map((image) => image.getAttribute("src") ?? image.getAttribute("data-src") ?? "").filter(Boolean),
    element
  };
}
export function parseVideoCardElement(element, source) {
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  const contentRoot = element.shadowRoot ?? element;
  const titleElement = queryDeepFirst(contentRoot, SITE_SELECTORS.videoTitle);
  const title = titleElement?.getAttribute("title")?.trim() || titleElement?.textContent?.trim() || "";
  if (!title) {
    return null;
  }
  const uploader = queryDeepFirst(contentRoot, SITE_SELECTORS.videoUploader);
  const uploaderLink = uploader?.closest("a") ?? (uploader?.matches("a") ? uploader : null);
  return {
    id: stableElementId(element, "video"),
    source,
    title,
    uploaderId: extractSpaceId(uploaderLink?.getAttribute("href") ?? null),
    uploaderName: uploader?.textContent?.trim() || void 0,
    viewCount: parseVideoViewCount(contentRoot),
    durationSeconds: parseVideoDuration(contentRoot),
    element
  };
}
