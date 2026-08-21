// Recovered from BiliClean v0.1.4 distribution module: src/content/core/normalizer.ts
export var ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/gu;
export var WHITESPACE = /\s+/gu;
export var REPEATED_CHARACTERS = /(.)\1{2,}/gu;
export function normalizeText(value, caseSensitive = false) {
  const normalized = value.normalize("NFKC").replace(ZERO_WIDTH, "").replace(WHITESPACE, " ").trim();
  return caseSensitive ? normalized : normalized.toLocaleLowerCase();
}
export function makeRepeatedCharacterCopy(value) {
  return normalizeText(value).replace(REPEATED_CHARACTERS, "$1$1");
}
export function normalizeIdentity(value) {
  return value ? normalizeText(value).replace(/^@/u, "") : "";
}
