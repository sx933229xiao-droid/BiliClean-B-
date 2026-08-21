// Recovered from BiliClean v0.1.4 distribution module: src/content/core/heuristics.ts
import { normalizeText } from "./normalizer.js";

export var SYMBOL_OR_PUNCTUATION = /[\p{P}\p{S}\p{Extended_Pictographic}]/gu;
export var MEANINGFUL_CHARACTER = /[\p{L}\p{N}]/gu;
export var SPAM_PATTERNS = [
  /(?:加|添加|联系)(?:微|薇|v|q{1,2})(?:信|号)?/iu,
  /免费(?:领取|下载|试看|教学)/iu,
  /兼职(?:刷单|返利)/iu,
  /关注.{0,8}(?:领取|获取|私信)/iu,
  /(?:代理|推广|引流).{0,8}(?:联系|私聊)/iu
];
export function longestRunLength(characters) {
  let longest = 0;
  let current = 0;
  let previous = "";
  for (const character of characters) {
    if (character === previous) {
      current += 1;
    } else {
      previous = character;
      current = 1;
    }
    longest = Math.max(longest, current);
  }
  return longest;
}
export function analyzeQuality(value) {
  const normalized = normalizeText(value);
  const visible = [...normalized.replace(/\s/gu, "")];
  const meaningful = normalized.match(MEANINGFUL_CHARACTER) ?? [];
  const symbolCount = normalized.match(SYMBOL_OR_PUNCTUATION)?.length ?? 0;
  const maximumRepeatRatio = visible.length ? longestRunLength(visible) / visible.length : 0;
  const symbolRatio = visible.length ? symbolCount / visible.length : 0;
  const effectiveLength = new Set(meaningful).size;
  const lowInformation = meaningful.length > 0 && effectiveLength <= 1 && visible.length <= 4 || visible.length >= 4 && maximumRepeatRatio >= 0.7 || visible.length >= 3 && symbolRatio >= 0.75 || visible.length > 0 && meaningful.length === 0;
  return {
    effectiveLength,
    maximumRepeatRatio,
    symbolRatio,
    lowInformation,
    spam: SPAM_PATTERNS.some((pattern) => pattern.test(normalized))
  };
}
