import test from "node:test";
import assert from "node:assert/strict";

import {
  makeRepeatedCharacterCopy,
  normalizeIdentity,
  normalizeText
} from "../src/content/core/normalizer.js";
import { analyzeQuality } from "../src/content/core/heuristics.js";
import {
  extractSpaceId,
  parseCompactNumber,
  parseRelativeTimestamp
} from "../src/content/adapters/dom-utils.js";
import { matchSupportedPage } from "../src/content/adapters/page-matcher.js";

test("文本标准化处理全角、零宽字符、空白和大小写", () => {
  assert.equal(normalizeText("  Ａ\u200b  B  "), "a b");
  assert.equal(normalizeText("AbC", true), "AbC");
  assert.equal(makeRepeatedCharacterCopy("哈哈哈哈哈"), "哈哈");
  assert.equal(normalizeIdentity(" @Alice "), "alice");
});

test("质量启发式识别广告和低信息内容", () => {
  assert.equal(analyzeQuality("加微信免费领取").spam, true);
  assert.equal(analyzeQuality("哈哈哈哈").lowInformation, true);
  assert.equal(analyzeQuality("这是一个正常且有信息量的句子").lowInformation, false);
});

test("B 站数字、相对时间和空间 ID 解析保持 v0.1.4 语义", () => {
  assert.equal(parseCompactNumber("1.2万"), 12_000);
  assert.equal(parseCompactNumber("3k"), 3_000);
  assert.equal(parseCompactNumber("2 亿"), 200_000_000);

  const now = Date.UTC(2026, 0, 2, 0, 0, 0);
  assert.equal(parseRelativeTimestamp("2 小时前", now), now - 7_200_000);
  assert.equal(parseRelativeTimestamp("刚刚", now), now);
  assert.equal(extractSpaceId("https://space.bilibili.com/12345"), "12345");
});

test("页面匹配器只启用视频页、首页和搜索页", () => {
  assert.equal(matchSupportedPage(new URL("https://www.bilibili.com/")), "home");
  assert.equal(matchSupportedPage(new URL("https://www.bilibili.com/video/BV1xx")), "video");
  assert.equal(matchSupportedPage(new URL("https://search.bilibili.com/all?keyword=x")), "search");
  assert.equal(matchSupportedPage(new URL("https://space.bilibili.com/1")), "unsupported");
});
