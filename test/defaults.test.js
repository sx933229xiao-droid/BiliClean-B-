import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SETTINGS,
  applyCleanModePreset,
  cloneDefaultState,
  isCleaningActive
} from "../src/shared/defaults.js";

test("cloneDefaultState 返回独立状态并写入统计起始时间", () => {
  const before = Date.now();
  const state = cloneDefaultState();
  const after = Date.now();

  assert.notStrictEqual(state.settings, DEFAULT_SETTINGS);
  assert.ok(state.stats.startedAt >= before && state.stats.startedAt <= after);
  state.settings.enabled = false;
  assert.equal(DEFAULT_SETTINGS.enabled, true);
});

test("严格模式预设启用直接低赞过滤", () => {
  const settings = structuredClone(DEFAULT_SETTINGS);
  settings.comments.maxLowLikeCount = 0;

  applyCleanModePreset(settings, "strict");

  assert.equal(settings.mode, "strict");
  assert.equal(settings.comments.lowLikeEnabled, true);
  assert.equal(settings.comments.maxLowLikeCount, 1);
  assert.equal(settings.comments.requireCombinedWeakSignals, false);
});

test("总开关和暂停时间共同决定是否净化", () => {
  const now = 1_000;
  const settings = structuredClone(DEFAULT_SETTINGS);
  assert.equal(isCleaningActive(settings, now), true);

  settings.pausedUntil = now + 1;
  assert.equal(isCleaningActive(settings, now), false);

  settings.pausedUntil = now;
  assert.equal(isCleaningActive(settings, now), true);

  settings.enabled = false;
  assert.equal(isCleaningActive(settings, now), false);
});
