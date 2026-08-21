import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_SETTINGS, cloneDefaultState } from "../src/shared/defaults.js";
import {
  sanitizeRule,
  sanitizeSettings,
  sanitizeStoredState,
  sanitizeUserLists,
  validateImportBundle
} from "../src/shared/validation.js";

test("设置校验强制保留静默隐藏策略并限制数值范围", () => {
  const settings = sanitizeSettings({
    schemaVersion: 3,
    mode: "unknown",
    comments: {
      defaultAction: "blur",
      showReasons: true,
      minUserLevel: 99,
      maxLowLikeCount: -10
    },
    videos: {
      placeholderMode: "placeholder",
      minDurationSeconds: 999_999
    }
  });

  assert.equal(settings.mode, DEFAULT_SETTINGS.mode);
  assert.equal(settings.comments.defaultAction, "hide");
  assert.equal(settings.comments.showReasons, false);
  assert.equal(settings.comments.minUserLevel, 6);
  assert.equal(settings.comments.maxLowLikeCount, 0);
  assert.equal(settings.videos.placeholderMode, "remove");
  assert.equal(settings.videos.minDurationSeconds, 86_400);
});

test("旧版状态迁移时默认启用本地数量统计", () => {
  const settings = sanitizeSettings({
    schemaVersion: 2,
    privacy: { localStatsEnabled: false }
  });
  assert.equal(settings.schemaVersion, 3);
  assert.equal(settings.privacy.localStatsEnabled, true);
});

test("规则和名单会被裁剪、去重和校验", () => {
  const rule = sanitizeRule({
    id: "rule-1",
    name: "  示例规则  ",
    enabled: true,
    priority: 200,
    target: "comment",
    scopes: ["video", "video", "invalid"],
    matcher: { type: "contains", pattern: "测试", caseSensitive: false },
    action: "hide",
    createdAt: 1,
    updatedAt: 2
  });
  assert.equal(rule?.name, "示例规则");
  assert.deepEqual(rule?.scopes, ["video"]);
  assert.equal(sanitizeRule({ id: "bad" }), null);
  assert.deepEqual(sanitizeUserLists({ blocked: [" Alice ", "Alice", ""] }).blocked, ["Alice"]);
});

test("导入只接受 BiliClean v1 备份结构", () => {
  assert.throws(() => validateImportBundle({ app: "other", exportVersion: 1 }));

  const state = cloneDefaultState();
  const imported = validateImportBundle({
    app: "BiliClean",
    exportVersion: 1,
    settings: state.settings,
    rules: state.rules,
    userLists: state.userLists,
    stats: state.stats
  });
  assert.deepEqual(sanitizeStoredState(imported), imported);
});
