import test from "node:test";
import assert from "node:assert/strict";

import { cloneDefaultState } from "../src/shared/defaults.js";
import {
  evaluateComment,
  evaluateVideoCard,
  matchesRuleText,
  validateRegexPattern
} from "../src/content/core/rule-engine.js";

function comment(overrides = {}) {
  return {
    id: "comment-1",
    source: "video",
    text: "这是一条正常评论",
    authorId: "100",
    authorName: "用户甲",
    likeCount: 20,
    authorLevel: 6,
    publishTimestamp: Date.now() - 48 * 60 * 60 * 1_000,
    hasAtMention: false,
    images: [],
    ...overrides
  };
}

function video(overrides = {}) {
  return {
    id: "video-1",
    source: "home",
    title: "普通视频",
    uploaderId: "200",
    uploaderName: "UP主甲",
    viewCount: 100_000,
    durationSeconds: 120,
    ...overrides
  };
}

test("正则规则拒绝无效或明显高回溯风险模式", () => {
  assert.equal(validateRegexPattern("["), "正则表达式无效。");
  assert.match(validateRegexPattern("(a+)+") ?? "", /严重回溯/u);
  assert.equal(validateRegexPattern("正常|测试"), null);
});

test("关键词匹配支持 contains、whole-word 和大小写选项", () => {
  const baseRule = {
    matcher: { type: "contains", pattern: "ABC", caseSensitive: false }
  };
  assert.equal(matchesRuleText("xxabcxx", baseRule), true);
  assert.equal(matchesRuleText("xxabcxx", {
    matcher: { ...baseRule.matcher, caseSensitive: true }
  }), false);
  assert.equal(matchesRuleText("say cat now", {
    matcher: { type: "whole-word", pattern: "cat", caseSensitive: false }
  }), true);
});

test("@ 评论只有字数和点赞都严格超过阈值才保留", () => {
  const state = cloneDefaultState();
  const shortMention = evaluateComment(comment({
    text: "@Alice 谢谢",
    hasAtMention: true,
    likeCount: 101
  }), state);
  assert.equal(shortMention.action, "hide");
  assert.ok(shortMention.reasons.some((reason) => reason.code === "at-mention"));

  const longText = `@Alice ${"这是正常讨论内容".repeat(9)}`;
  const kept = evaluateComment(comment({
    text: longText,
    hasAtMention: true,
    likeCount: 101
  }), state);
  assert.equal(kept.action, "show");

  const equalToLikeThreshold = evaluateComment(comment({
    text: longText,
    hasAtMention: true,
    likeCount: 100
  }), state);
  assert.equal(equalToLikeThreshold.action, "hide");
});

test("评论用户白名单优先于内容规则", () => {
  const state = cloneDefaultState();
  state.userLists.allowed.push("100");
  const result = evaluateComment(comment({ text: "傻逼" }), state);
  assert.equal(result.action, "show");
  assert.equal(result.reasons[0].code, "author-allowlist");
});

test("视频播放量和时长阈值使用严格小于比较", () => {
  const state = cloneDefaultState();
  assert.equal(evaluateVideoCard(video({ viewCount: 49_999 }), state).action, "hide");
  assert.equal(evaluateVideoCard(video({ durationSeconds: 59 }), state).action, "hide");
  assert.equal(evaluateVideoCard(video({ viewCount: 50_000, durationSeconds: 60 }), state).action, "show");
});
