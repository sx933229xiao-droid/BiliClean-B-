// Recovered from BiliClean v0.1.4 distribution module: src/content/core/rule-engine.ts
import { normalizeText, makeRepeatedCharacterCopy, normalizeIdentity } from "./normalizer.js";
import { analyzeQuality } from "./heuristics.js";

export var ACTION_SEVERITY = {
  show: 0,
  collapse: 1,
  blur: 2,
  hide: 3
};
export var CONSERVATIVE_CATEGORY_PATTERNS = {
  insult: [
    /(?:傻逼|煞笔|脑残|弱智|智障|废物|狗东西|去死吧|滚出去|你妈死了|没妈)/iu,
    /(?:垃圾东西|恶心玩意|畜生东西)/iu
  ],
  sexualInnuendo: [
    /(?:想睡你|馋.{0,3}身子|脱.{0,3}衣服|床上等你|狠狠干|透一透)/iu,
    /(?:胸|屁股|大腿).{0,4}(?:真香|让我摸|让我舔)/iu
  ],
  sexualObjectification: [
    /(?:性奴|肉便器|玩弄.{0,4}身体|当作泄欲)/iu,
    /(?:把她|把他).{0,5}(?:绑上床|按在床上)/iu
  ],
  sexualShaming: [
    /(?:荡妇|婊子|公交车|处女婊|破鞋|卖肉的)/iu,
    /(?:性无能|没人要的剩女|没人要的剩男)/iu
  ],
  provocation: [
    /(?:引战狗|急了急了|破防了吧|孝死我了|又蠢又坏)/iu,
    /(?:你们这群|这种人都).{0,6}(?:该死|滚出去)/iu
  ]
};
export function getEnabledCategories(state) {
  const custom = state.settings.categories;
  if (state.settings.mode === "custom") {
    return custom;
  }
  if (state.settings.mode === "light") {
    return {
      insult: true,
      sexualInnuendo: false,
      sexualObjectification: false,
      sexualShaming: false,
      provocation: false,
      spam: true,
      lowInformation: false
    };
  }
  const strict = state.settings.mode === "strict";
  return {
    insult: true,
    sexualInnuendo: true,
    sexualObjectification: true,
    sexualShaming: true,
    provocation: true,
    spam: true,
    lowInformation: strict
  };
}
export function identityMatches(entries, id, name) {
  const normalizedId = normalizeIdentity(id);
  const normalizedName = normalizeIdentity(name);
  return entries.some((entry) => {
    const normalized = normalizeIdentity(entry);
    return Boolean(normalized) && (normalized === normalizedId || normalized === normalizedName);
  });
}
export function validateRegexPattern(pattern) {
  if (pattern.length > 200) {
    return "正则表达式不能超过 200 个字符。";
  }
  if (/(?:\([^)]*[+*][^)]*\))[+*{]/u.test(pattern) || /(?:\.\*){2,}/u.test(pattern)) {
    return "正则表达式包含可能造成严重回溯的嵌套量词。";
  }
  try {
    void new RegExp(pattern, "u");
    return null;
  } catch {
    return "正则表达式无效。";
  }
}
export function matchesRuleText(text, rule) {
  const caseSensitive = rule.matcher.caseSensitive;
  const haystack = normalizeText(text, caseSensitive);
  const needle = normalizeText(rule.matcher.pattern, caseSensitive);
  switch (rule.matcher.type) {
    case "contains":
      return haystack.includes(needle);
    case "prefix":
      return haystack.startsWith(needle);
    case "suffix":
      return haystack.endsWith(needle);
    case "whole-word": {
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}($|[^\\p{L}\\p{N}_])`, "u").test(haystack);
    }
    case "regex": {
      if (validateRegexPattern(rule.matcher.pattern)) {
        return false;
      }
      const flags = caseSensitive ? "u" : "iu";
      return new RegExp(rule.matcher.pattern, flags).test(text.slice(0, 5e3));
    }
    default:
      return false;
  }
}
export function matchRules(rules, scope, targets) {
  const results = [];
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    if (!rule.enabled || rule.scopes.length > 0 && !rule.scopes.includes(scope)) {
      continue;
    }
    const target = targets.find((item) => item.target === rule.target);
    if (!target || !matchesRuleText(target.value, rule)) {
      continue;
    }
    results.push({
      action: rule.action,
      reason: {
        code: "keyword-rule",
        label: `命中规则：${rule.name}`,
        ruleId: rule.id
      }
    });
  }
  return results;
}
export function strongestAction(matches, fallback) {
  return matches.reduce(
    (current, item) => ACTION_SEVERITY[item.action] > ACTION_SEVERITY[current] ? item.action : current,
    fallback
  );
}
export function decision(startedAt, action, reasons) {
  return {
    action,
    severity: ACTION_SEVERITY[action],
    reasons,
    processingMs: performance.now() - startedAt
  };
}
export function detectCategories(text, categories) {
  const normalized = makeRepeatedCharacterCopy(text);
  const reasons = [];
  const labels = {
    insult: "辱骂或人身攻击",
    sexualInnuendo: "明显性暗示",
    sexualObjectification: "性物化内容",
    sexualShaming: "性或关系羞辱",
    provocation: "引战或挑衅"
  };
  for (const key of Object.keys(CONSERVATIVE_CATEGORY_PATTERNS)) {
    if (categories[key] && CONSERVATIVE_CATEGORY_PATTERNS[key].some((pattern) => pattern.test(normalized))) {
      reasons.push({ code: `category-${key}`, label: labels[key] });
    }
  }
  return reasons;
}
export function commentScope(item) {
  return item.source === "video" ? "video" : item.source;
}
export function visibleTextLength(text) {
  return Array.from(text.replace(/[\s\u200b-\u200f\u2060\ufeff]/gu, "")).length;
}
export function containsAtMention(text) {
  return /(?:@|＠)[^\s@＠]+/u.test(text);
}
export function evaluateComment(item, state, now = Date.now()) {
  const startedAt = performance.now();
  if (identityMatches(state.userLists.allowed, item.authorId, item.authorName)) {
    return decision(startedAt, "show", [{ code: "author-allowlist", label: "用户白名单" }]);
  }
  if (identityMatches(state.userLists.blocked, item.authorId, item.authorName)) {
    return decision(startedAt, "hide", [{ code: "author-blocklist", label: "用户黑名单" }]);
  }
  const ruleMatches = matchRules(state.rules, commentScope(item), [
    { target: "comment", value: item.text },
    { target: "author", value: `${item.authorId ?? ""} ${item.authorName ?? ""}` }
  ]);
  const reasons = ruleMatches.map((item2) => item2.reason);
  const categories = getEnabledCategories(state);
  reasons.push(...detectCategories(item.text, categories));
  if (state.settings.comments.atMentionEnabled && (item.hasAtMention || containsAtMention(item.text))) {
    const keepMentionComment = visibleTextLength(item.text) > state.settings.comments.atMentionKeepTextLength && item.likeCount !== void 0 && item.likeCount > state.settings.comments.atMentionKeepLikeCount;
    if (!keepMentionComment) {
      reasons.push({
        code: "at-mention",
        label: "含 @ 的短回复或低赞互动"
      });
    }
  }
  const quality = analyzeQuality(item.text);
  if (categories.spam && quality.spam) {
    reasons.push({ code: "category-spam", label: "广告或引流模板" });
  }
  if (categories.lowInformation && quality.lowInformation) {
    reasons.push({ code: "low-information", label: "低信息量或符号刷屏" });
  }
  const hasStrongContentSignal = reasons.length > 0;
  const graceMs = state.settings.comments.newCommentGraceHours * 60 * 60 * 1e3;
  const outsideGrace = item.publishTimestamp !== void 0 && now - item.publishTimestamp >= graceMs;
  const lowLike = state.settings.comments.lowLikeEnabled && item.likeCount !== void 0 && outsideGrace && item.likeCount <= state.settings.comments.maxLowLikeCount;
  const lowLevel = state.settings.comments.minUserLevelEnabled && item.authorLevel !== void 0 && item.authorLevel < state.settings.comments.minUserLevel;
  const weakSignalsCanTrigger = !state.settings.comments.requireCombinedWeakSignals || hasStrongContentSignal || quality.lowInformation || quality.spam;
  if (weakSignalsCanTrigger && lowLike) {
    reasons.push({ code: "low-like", label: `点赞数不高于 ${state.settings.comments.maxLowLikeCount}` });
  }
  if (weakSignalsCanTrigger && lowLevel) {
    reasons.push({ code: "low-level", label: `用户等级低于 ${state.settings.comments.minUserLevel}` });
  }
  if (reasons.length === 0) {
    return decision(startedAt, "show", []);
  }
  const fallback = state.settings.comments.defaultAction;
  return decision(startedAt, strongestAction(ruleMatches, fallback), reasons);
}
export function evaluateVideoCard(card, state) {
  const startedAt = performance.now();
  if (identityMatches(
    state.userLists.uploaderAllowed,
    card.uploaderId,
    card.uploaderName
  )) {
    return decision(startedAt, "show", [{ code: "uploader-allowlist", label: "UP 主白名单" }]);
  }
  if (identityMatches(
    state.userLists.uploaderBlocked,
    card.uploaderId,
    card.uploaderName
  )) {
    return decision(startedAt, "hide", [{ code: "uploader-blocklist", label: "UP 主黑名单" }]);
  }
  const scope = card.source === "related" ? "video" : card.source;
  const matches = matchRules(state.rules, scope, [
    { target: "video-title", value: card.title },
    { target: "author", value: `${card.uploaderId ?? ""} ${card.uploaderName ?? ""}` }
  ]);
  const reasons = matches.map((item) => item.reason);
  if (state.settings.videos.lowViewEnabled && card.viewCount !== void 0 && card.viewCount < state.settings.videos.minViewCount) {
    reasons.push({
      code: "low-view-count",
      label: `播放量低于 ${state.settings.videos.minViewCount}`
    });
  }
  if (state.settings.videos.shortDurationEnabled && card.durationSeconds !== void 0 && card.durationSeconds < state.settings.videos.minDurationSeconds) {
    reasons.push({
      code: "short-duration",
      label: `视频时长短于 ${state.settings.videos.minDurationSeconds} 秒`
    });
  }
  if (reasons.length === 0) {
    return decision(startedAt, "show", []);
  }
  return decision(startedAt, "hide", reasons);
}
