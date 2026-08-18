"use strict";
(() => {
  // src/shared/defaults.ts
  var STORAGE_KEY = "biliclean.state.v1";
  var DEFAULT_SETTINGS = {
    schemaVersion: 3,
    enabled: true,
    mode: "standard",
    pausedUntil: null,
    modules: {
      comments: true,
      videos: true,
      danmaku: true
    },
    comments: {
      defaultAction: "hide",
      showReasons: false,
      atMentionEnabled: true,
      atMentionKeepTextLength: 50,
      atMentionKeepLikeCount: 100,
      lowLikeEnabled: false,
      maxLowLikeCount: 1,
      newCommentGraceHours: 24,
      minUserLevelEnabled: false,
      minUserLevel: 1,
      requireCombinedWeakSignals: true
    },
    videos: {
      homeEnabled: true,
      searchEnabled: true,
      lowViewEnabled: true,
      minViewCount: 5e4,
      shortDurationEnabled: true,
      minDurationSeconds: 60,
      placeholderMode: "remove"
    },
    danmaku: {
      defaultOff: true,
      allowManualEnableForCurrentVideo: true
    },
    categories: {
      insult: true,
      sexualInnuendo: true,
      sexualObjectification: true,
      sexualShaming: true,
      provocation: true,
      spam: true,
      lowInformation: false
    },
    privacy: {
      localStatsEnabled: true,
      diagnosticsEnabled: false
    }
  };
  var DEFAULT_STATE = {
    settings: DEFAULT_SETTINGS,
    rules: [],
    userLists: {
      blocked: [],
      allowed: [],
      uploaderBlocked: [],
      uploaderAllowed: []
    },
    stats: {
      commentsBlocked: 0,
      videosBlocked: 0,
      startedAt: 0
    }
  };
  function cloneDefaultState() {
    const state = structuredClone(DEFAULT_STATE);
    state.stats.startedAt = Date.now();
    return state;
  }
  function applyCleanModePreset(settings, mode) {
    settings.mode = mode;
    if (mode === "strict") {
      settings.comments.lowLikeEnabled = true;
      settings.comments.maxLowLikeCount = Math.max(1, settings.comments.maxLowLikeCount);
      settings.comments.requireCombinedWeakSignals = false;
    }
    return settings;
  }
  function isCleaningActive(settings, now = Date.now()) {
    return settings.enabled && (settings.pausedUntil === null || settings.pausedUntil <= now);
  }

  // src/shared/validation.ts
  var MODES = /* @__PURE__ */ new Set(["light", "standard", "strict", "custom"]);
  var ACTIONS = /* @__PURE__ */ new Set(["collapse", "blur", "hide"]);
  var TARGETS = /* @__PURE__ */ new Set(["comment", "video-title", "author"]);
  var SCOPES = /* @__PURE__ */ new Set(["video", "home", "search", "dynamic", "space"]);
  var MATCHERS = /* @__PURE__ */ new Set(["contains", "whole-word", "prefix", "suffix", "regex"]);
  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
  function bool(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }
  function boundedNumber(value, fallback, min, max) {
    return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  }
  function nullableTimestamp(value) {
    if (value === null) {
      return null;
    }
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  }
  function cleanStrings(value, limit = 2e3) {
    if (!Array.isArray(value)) {
      return [];
    }
    return [...new Set(
      value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, limit)
    )];
  }
  function cleanCategories(value) {
    const input = isRecord(value) ? value : {};
    const fallback = DEFAULT_SETTINGS.categories;
    return {
      insult: bool(input.insult, fallback.insult),
      sexualInnuendo: bool(input.sexualInnuendo, fallback.sexualInnuendo),
      sexualObjectification: bool(input.sexualObjectification, fallback.sexualObjectification),
      sexualShaming: bool(input.sexualShaming, fallback.sexualShaming),
      provocation: bool(input.provocation, fallback.provocation),
      spam: bool(input.spam, fallback.spam),
      lowInformation: bool(input.lowInformation, fallback.lowInformation)
    };
  }
  function sanitizeSettings(value) {
    const input = isRecord(value) ? value : {};
    const modules = isRecord(input.modules) ? input.modules : {};
    const comments = isRecord(input.comments) ? input.comments : {};
    const videos = isRecord(input.videos) ? input.videos : {};
    const danmaku = isRecord(input.danmaku) ? input.danmaku : {};
    const privacy = isRecord(input.privacy) ? input.privacy : {};
    const mode = MODES.has(input.mode) ? input.mode : DEFAULT_SETTINGS.mode;
    const sourceSchemaVersion = typeof input.schemaVersion === "number" ? input.schemaVersion : 1;
    const sanitized = {
      schemaVersion: 3,
      enabled: bool(input.enabled, DEFAULT_SETTINGS.enabled),
      mode,
      pausedUntil: nullableTimestamp(input.pausedUntil),
      modules: {
        comments: bool(modules.comments, DEFAULT_SETTINGS.modules.comments),
        videos: bool(modules.videos, DEFAULT_SETTINGS.modules.videos),
        danmaku: bool(modules.danmaku, DEFAULT_SETTINGS.modules.danmaku)
      },
      comments: {
        // v0.1.2 起评论命中后统一静默隐藏；保留字段仅用于兼容旧导出文件。
        defaultAction: "hide",
        showReasons: false,
        atMentionEnabled: bool(
          comments.atMentionEnabled,
          DEFAULT_SETTINGS.comments.atMentionEnabled
        ),
        atMentionKeepTextLength: boundedNumber(
          comments.atMentionKeepTextLength,
          DEFAULT_SETTINGS.comments.atMentionKeepTextLength,
          0,
          1e4
        ),
        atMentionKeepLikeCount: boundedNumber(
          comments.atMentionKeepLikeCount,
          DEFAULT_SETTINGS.comments.atMentionKeepLikeCount,
          0,
          1e8
        ),
        lowLikeEnabled: bool(comments.lowLikeEnabled, DEFAULT_SETTINGS.comments.lowLikeEnabled),
        maxLowLikeCount: boundedNumber(
          comments.maxLowLikeCount,
          DEFAULT_SETTINGS.comments.maxLowLikeCount,
          0,
          1e6
        ),
        newCommentGraceHours: boundedNumber(
          comments.newCommentGraceHours,
          DEFAULT_SETTINGS.comments.newCommentGraceHours,
          0,
          720
        ),
        minUserLevelEnabled: bool(
          comments.minUserLevelEnabled,
          DEFAULT_SETTINGS.comments.minUserLevelEnabled
        ),
        minUserLevel: boundedNumber(
          comments.minUserLevel,
          DEFAULT_SETTINGS.comments.minUserLevel,
          0,
          6
        ),
        requireCombinedWeakSignals: bool(
          comments.requireCombinedWeakSignals,
          DEFAULT_SETTINGS.comments.requireCombinedWeakSignals
        )
      },
      videos: {
        homeEnabled: bool(videos.homeEnabled, DEFAULT_SETTINGS.videos.homeEnabled),
        searchEnabled: bool(videos.searchEnabled, DEFAULT_SETTINGS.videos.searchEnabled),
        lowViewEnabled: bool(videos.lowViewEnabled, DEFAULT_SETTINGS.videos.lowViewEnabled),
        minViewCount: boundedNumber(
          videos.minViewCount,
          DEFAULT_SETTINGS.videos.minViewCount,
          0,
          1e10
        ),
        shortDurationEnabled: bool(
          videos.shortDurationEnabled,
          DEFAULT_SETTINGS.videos.shortDurationEnabled
        ),
        minDurationSeconds: boundedNumber(
          videos.minDurationSeconds,
          DEFAULT_SETTINGS.videos.minDurationSeconds,
          0,
          86400
        ),
        // v0.1.3 起首页和搜索页视频均静默隐藏，不再生成任何占位提示。
        placeholderMode: "remove"
      },
      danmaku: {
        defaultOff: bool(danmaku.defaultOff, DEFAULT_SETTINGS.danmaku.defaultOff),
        allowManualEnableForCurrentVideo: bool(
          danmaku.allowManualEnableForCurrentVideo,
          DEFAULT_SETTINGS.danmaku.allowManualEnableForCurrentVideo
        )
      },
      categories: cleanCategories(input.categories),
      privacy: {
        // v0.1.4 开始数量统计正式可用；旧版中的占位开关统一迁移为默认开启。
        localStatsEnabled: sourceSchemaVersion < 3 ? true : bool(privacy.localStatsEnabled, DEFAULT_SETTINGS.privacy.localStatsEnabled),
        diagnosticsEnabled: bool(
          privacy.diagnosticsEnabled,
          DEFAULT_SETTINGS.privacy.diagnosticsEnabled
        )
      }
    };
    if (sourceSchemaVersion < 2 && mode === "strict") {
      applyCleanModePreset(sanitized, "strict");
    }
    return sanitized;
  }
  function sanitizeStats(value) {
    const input = isRecord(value) ? value : {};
    return {
      commentsBlocked: Math.trunc(boundedNumber(
        input.commentsBlocked,
        0,
        0,
        Number.MAX_SAFE_INTEGER
      )),
      videosBlocked: Math.trunc(boundedNumber(
        input.videosBlocked,
        0,
        0,
        Number.MAX_SAFE_INTEGER
      )),
      startedAt: Math.trunc(boundedNumber(
        input.startedAt,
        Date.now(),
        0,
        Number.MAX_SAFE_INTEGER
      ))
    };
  }
  function sanitizeRule(value) {
    if (!isRecord(value)) {
      return null;
    }
    const matcher = isRecord(value.matcher) ? value.matcher : {};
    const id = typeof value.id === "string" ? value.id.slice(0, 100) : "";
    const pattern = typeof matcher.pattern === "string" ? matcher.pattern.slice(0, 500) : "";
    const target = TARGETS.has(value.target) ? value.target : null;
    const action = ACTIONS.has(value.action) ? value.action : null;
    const matcherType = MATCHERS.has(matcher.type) ? matcher.type : null;
    if (!id || !pattern || !target || !action || !matcherType) {
      return null;
    }
    const scopes = Array.isArray(value.scopes) ? value.scopes.filter((scope) => SCOPES.has(scope)) : [];
    const now = Date.now();
    return {
      id,
      name: typeof value.name === "string" && value.name.trim() ? value.name.trim().slice(0, 100) : pattern.slice(0, 30),
      enabled: bool(value.enabled, true),
      priority: boundedNumber(value.priority, 100, -1e4, 1e4),
      target,
      scopes: [...new Set(scopes)].slice(0, 5),
      matcher: {
        type: matcherType,
        pattern,
        caseSensitive: bool(matcher.caseSensitive, false)
      },
      action,
      createdAt: boundedNumber(value.createdAt, now, 0, Number.MAX_SAFE_INTEGER),
      updatedAt: boundedNumber(value.updatedAt, now, 0, Number.MAX_SAFE_INTEGER)
    };
  }
  function sanitizeRules(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.slice(0, 2e3).map(sanitizeRule).filter((rule) => rule !== null).sort((a, b) => b.priority - a.priority);
  }
  function sanitizeUserLists(value) {
    const input = isRecord(value) ? value : {};
    return {
      blocked: cleanStrings(input.blocked),
      allowed: cleanStrings(input.allowed),
      uploaderBlocked: cleanStrings(input.uploaderBlocked),
      uploaderAllowed: cleanStrings(input.uploaderAllowed)
    };
  }
  function sanitizeStoredState(value) {
    if (!isRecord(value)) {
      return cloneDefaultState();
    }
    return {
      settings: sanitizeSettings(value.settings),
      rules: sanitizeRules(value.rules),
      userLists: sanitizeUserLists(value.userLists),
      stats: sanitizeStats(value.stats)
    };
  }

  // src/content/adapters/selectors.ts
  var SITE_SELECTORS = {
    commentItems: [
      "bili-comment-thread-renderer",
      "bili-comment-reply-renderer",
      "bili-comment-renderer",
      ".reply-item",
      ".root-reply-container",
      ".sub-reply-item",
      ".list-item.reply-wrap",
      "[data-reply-id]",
      "[data-rpid]"
    ],
    subCommentItems: [
      "bili-comment-reply-renderer",
      ".sub-reply-item",
      ".sub-reply-container [data-reply-id]",
      ".reply-box .reply-item"
    ],
    commentText: [
      "#contents",
      "#content",
      "bili-rich-text",
      ".reply-content",
      ".sub-reply-content",
      ".reply-content-container",
      ".con .text",
      '[class*="reply-content"]'
    ],
    commentMentions: [
      "bili-rich-text-at",
      '[data-type="at"]',
      'a[href*="space.bilibili.com"]',
      'a[href*="/space/"]',
      ".jump-link.user"
    ],
    commentAuthor: [
      "#user-name a",
      "#user-name",
      ".user-name",
      ".sub-user-name",
      ".name",
      '[class*="user-name"]'
    ],
    commentAuthorLink: [
      'a[href*="space.bilibili.com"]',
      'a[href*="/space/"]'
    ],
    commentLikes: [
      "#like #count",
      "#like [data-count]",
      "[data-like-count]",
      ".like .count",
      ".like-count",
      ".reply-like .count",
      '[class*="like-count"]',
      '[class*="like"] .count'
    ],
    commentLevel: [
      'img[alt*="等级"]',
      'img[title*="等级"]',
      "[data-user-level]",
      '[class*="user-level"]',
      '[class*="level"] img'
    ],
    commentTime: [
      "#pubdate",
      ".pubdate",
      "time[datetime]",
      ".reply-time",
      ".time",
      ".info .time",
      '[class*="pubdate"]',
      '[class*="reply-time"]'
    ],
    commentImages: [
      ".reply-content img",
      ".sub-reply-content img",
      '[class*="reply-content"] img'
    ],
    homeVideoCards: [
      ".bili-video-card",
      ".feed-card",
      ".video-card",
      ".small-item",
      "[data-bvid]",
      'article[class*="video-card"]'
    ],
    searchVideoCards: [
      ".bili-video-card",
      ".video-item",
      ".video-list-item",
      '.search-all-list article[class*="video-card"]',
      "[data-bvid]"
    ],
    videoTitle: [
      ".bili-video-card__info--tit",
      ".title",
      ".headline",
      'a[title][href*="/video/"]',
      'a[href*="/video/"][title]'
    ],
    videoUploader: [
      ".bili-video-card__info--author",
      ".up-name",
      ".author",
      'a[href*="space.bilibili.com"]'
    ],
    videoViews: [
      "[data-view-count]",
      "[data-play-count]",
      "[data-play]",
      ".bili-video-card__stats--play",
      ".bili-video-card__stats--item:first-child",
      ".bili-video-card__stats--item",
      ".so-icon.watch-num",
      ".play",
      '[class*="view-count"]',
      '[class*="play-count"]'
    ],
    videoDuration: [
      "[data-duration]",
      "[data-duration-seconds]",
      ".bili-video-card__stats__duration",
      ".duration",
      ".video-duration",
      '[class*="video-duration"]',
      '[class*="duration"]'
    ],
    danmakuToggles: [
      '.bpx-player-dm-switch input[type="checkbox"]',
      '.bpx-player-dm-switch [role="switch"]',
      ".bpx-player-dm-switch",
      '.bilibili-player-video-danmaku-switch input[type="checkbox"]',
      '.bilibili-player-video-danmaku-switch [role="switch"]',
      ".bilibili-player-video-danmaku-switch",
      '[aria-label*="弹幕"][role="switch"]',
      '[data-text*="弹幕"][role="switch"]'
    ]
  };

  // src/content/core/normalizer.ts
  var ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/gu;
  var WHITESPACE = /\s+/gu;
  var REPEATED_CHARACTERS = /(.)\1{2,}/gu;
  function normalizeText(value, caseSensitive = false) {
    const normalized = value.normalize("NFKC").replace(ZERO_WIDTH, "").replace(WHITESPACE, " ").trim();
    return caseSensitive ? normalized : normalized.toLocaleLowerCase();
  }
  function makeRepeatedCharacterCopy(value) {
    return normalizeText(value).replace(REPEATED_CHARACTERS, "$1$1");
  }
  function normalizeIdentity(value) {
    return value ? normalizeText(value).replace(/^@/u, "") : "";
  }

  // src/content/core/heuristics.ts
  var SYMBOL_OR_PUNCTUATION = /[\p{P}\p{S}\p{Extended_Pictographic}]/gu;
  var MEANINGFUL_CHARACTER = /[\p{L}\p{N}]/gu;
  var SPAM_PATTERNS = [
    /(?:加|添加|联系)(?:微|薇|v|q{1,2})(?:信|号)?/iu,
    /免费(?:领取|下载|试看|教学)/iu,
    /兼职(?:刷单|返利)/iu,
    /关注.{0,8}(?:领取|获取|私信)/iu,
    /(?:代理|推广|引流).{0,8}(?:联系|私聊)/iu
  ];
  function longestRunLength(characters) {
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
  function analyzeQuality(value) {
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

  // src/content/core/rule-engine.ts
  var ACTION_SEVERITY = {
    show: 0,
    collapse: 1,
    blur: 2,
    hide: 3
  };
  var CONSERVATIVE_CATEGORY_PATTERNS = {
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
  function getEnabledCategories(state) {
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
  function identityMatches(entries, id, name) {
    const normalizedId = normalizeIdentity(id);
    const normalizedName = normalizeIdentity(name);
    return entries.some((entry) => {
      const normalized = normalizeIdentity(entry);
      return Boolean(normalized) && (normalized === normalizedId || normalized === normalizedName);
    });
  }
  function validateRegexPattern(pattern) {
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
  function matchesRuleText(text, rule) {
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
  function matchRules(rules, scope, targets) {
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
  function strongestAction(matches, fallback) {
    return matches.reduce(
      (current, item) => ACTION_SEVERITY[item.action] > ACTION_SEVERITY[current] ? item.action : current,
      fallback
    );
  }
  function decision(startedAt, action, reasons) {
    return {
      action,
      severity: ACTION_SEVERITY[action],
      reasons,
      processingMs: performance.now() - startedAt
    };
  }
  function detectCategories(text, categories) {
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
  function commentScope(item) {
    return item.source === "video" ? "video" : item.source;
  }
  function visibleTextLength(text) {
    return Array.from(text.replace(/[\s\u200b-\u200f\u2060\ufeff]/gu, "")).length;
  }
  function containsAtMention(text) {
    return /(?:@|＠)[^\s@＠]+/u.test(text);
  }
  function evaluateComment(item, state, now = Date.now()) {
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
  function evaluateVideoCard(card, state) {
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

  // src/content/adapters/dom-utils.ts
  function queryAll(root, selectors) {
    const results = /* @__PURE__ */ new Set();
    if (root instanceof Element && selectors.some((selector) => root.matches(selector))) {
      results.add(root);
    }
    for (const selector of selectors) {
      root.querySelectorAll(selector).forEach((element) => results.add(element));
    }
    return [...results];
  }
  function queryFirst(root, selectors) {
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
  function closestAny(element, selectors) {
    for (const selector of selectors) {
      const found = element.closest(selector);
      if (found) {
        return found;
      }
    }
    return null;
  }
  function collectOpenShadowRoots(root) {
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
  function queryDeepFirst(root, selectors) {
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
  function queryDeepAll(root, selectors) {
    const results = new Set(queryAll(root, selectors));
    for (const shadowRoot of collectOpenShadowRoots(root)) {
      queryAll(shadowRoot, selectors).forEach((element) => results.add(element));
    }
    return [...results];
  }
  function composedParent(element) {
    if (element.parentElement) {
      return element.parentElement;
    }
    const root = element.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
  }
  function closestComposed(element, selectors, includeSelf = true) {
    let current = includeSelf ? element : composedParent(element);
    while (current) {
      if (selectors.some((selector) => current?.matches(selector))) {
        return current;
      }
      current = composedParent(current);
    }
    return null;
  }
  function outermostComposedMatch(element, selectors) {
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
  function parseCompactNumber(value) {
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
  function parseRelativeTimestamp(value, now = Date.now()) {
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
  function extractSpaceId(href) {
    if (!href) {
      return void 0;
    }
    const match = href.match(/space\.bilibili\.com\/(\d+)/u) ?? href.match(/\/space\/(\d+)/u);
    return match?.[1];
  }
  function stableElementId(element, prefix) {
    const known = element.getAttribute("data-reply-id") ?? element.getAttribute("data-rpid") ?? element.getAttribute("data-bvid") ?? element.id;
    if (known) {
      return known;
    }
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  // src/content/adapters/base-adapter.ts
  var BaseAdapter = class {
    context;
    observers = [];
    observedRoots = /* @__PURE__ */ new WeakSet();
    pending = /* @__PURE__ */ new Set();
    frameId = null;
    destroyed = false;
    constructor(context) {
      this.context = context;
    }
    start() {
      this.destroyed = false;
      this.observeRoot(document);
      this.scan(document);
      this.observeDiscoveredShadows(document);
    }
    destroy() {
      this.destroyed = true;
      for (const observer of this.observers) {
        observer.disconnect();
      }
      this.observers.length = 0;
      if (this.frameId !== null) {
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }
      this.pending.clear();
    }
    rescan() {
      if (!this.destroyed) {
        this.scan(document);
        this.observeDiscoveredShadows(document);
      }
    }
    observeRoot(root) {
      const target = root instanceof Document ? root.documentElement : root;
      if (!target || this.observedRoots.has(target)) {
        return;
      }
      this.observedRoots.add(target);
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "childList") {
            for (const node of record.addedNodes) {
              const element = node instanceof Element ? node : node.parentElement;
              if (element) {
                this.pending.add(element);
              }
            }
          } else {
            const element = record.target instanceof Element ? record.target : record.target.parentElement;
            if (element) {
              this.pending.add(element);
            }
          }
        }
        this.scheduleFlush();
      });
      observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          "aria-label",
          "data-count",
          "data-like-count",
          "data-view-count",
          "data-play-count",
          "data-play",
          "data-duration",
          "data-duration-seconds",
          "data-time",
          "data-timestamp",
          "data-user-level",
          "datetime",
          "title"
        ]
      });
      this.observers.push(observer);
    }
    scheduleFlush() {
      if (this.frameId !== null || this.destroyed) {
        return;
      }
      const schedule = window.requestAnimationFrame ?? ((callback) => {
        return window.setTimeout(() => callback(performance.now()), 16);
      });
      this.frameId = schedule(() => {
        this.frameId = null;
        const items = [...this.pending];
        this.pending.clear();
        for (const element of items) {
          this.scan(element);
          this.observeDiscoveredShadows(element);
        }
      });
    }
    observeDiscoveredShadows(root) {
      for (const shadowRoot of collectOpenShadowRoots(root)) {
        this.observeRoot(shadowRoot);
        this.scan(shadowRoot);
      }
    }
  };

  // src/content/adapters/entity-parsers.ts
  function textOf(root, selectors) {
    for (const element of queryDeepAll(root, selectors)) {
      const text = element.textContent?.trim() ?? "";
      if (text) {
        return text;
      }
    }
    return "";
  }
  function attributeNumber(elements, names) {
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
  function parseLikeCount(root) {
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
  function parseTimestampValue(value) {
    const text = value.trim();
    if (/^\d{10,13}$/u.test(text)) {
      const numeric = Number(text);
      const milliseconds = text.length === 10 ? numeric * 1e3 : numeric;
      return Number.isFinite(milliseconds) ? milliseconds : void 0;
    }
    return parseRelativeTimestamp(text);
  }
  function parsePublishTimestamp(root) {
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
  function parseDurationValue(value) {
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
  function parseVideoViewCount(root) {
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
  function parseVideoDuration(root) {
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
  function parseCommentElement(element) {
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
  function parseVideoCardElement(element, source) {
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

  // src/content/adapters/video-card-adapter.ts
  var VideoCardAdapter = class extends BaseAdapter {
    fingerprints = /* @__PURE__ */ new WeakMap();
    constructor(context) {
      super(context);
    }
    rescan() {
      this.fingerprints = /* @__PURE__ */ new WeakMap();
      super.rescan();
    }
    scan(root) {
      const state = this.context.getState();
      if (!this.shouldRun(state)) {
        return;
      }
      const discovered = new Set(queryAll(root, this.cardSelectors));
      if (root instanceof Element) {
        const ancestor = outermostComposedMatch(root, this.cardSelectors);
        if (ancestor) {
          discovered.add(ancestor);
        }
      }
      const candidates = /* @__PURE__ */ new Set();
      for (const element of discovered) {
        candidates.add(outermostComposedMatch(element, this.cardSelectors) ?? element);
      }
      for (const element of candidates) {
        const card = parseVideoCardElement(element, this.source);
        if (!card) {
          continue;
        }
        const fingerprint = [
          card.title,
          card.uploaderId ?? "",
          card.uploaderName ?? "",
          card.viewCount ?? "",
          card.durationSeconds ?? ""
        ].join("");
        if (this.fingerprints.get(element) === fingerprint) {
          continue;
        }
        this.fingerprints.set(element, fingerprint);
        const result = evaluateVideoCard(card, state);
        this.context.renderer.applyVideoCard(card, result);
      }
    }
    shouldRun(state) {
      if (!state.settings.modules.videos) {
        return false;
      }
      return this.source === "home" ? state.settings.videos.homeEnabled : state.settings.videos.searchEnabled;
    }
  };

  // src/content/adapters/home-adapter.ts
  var HomeAdapter = class extends VideoCardAdapter {
    name = "首页";
    source = "home";
    cardSelectors = SITE_SELECTORS.homeVideoCards;
  };

  // src/content/adapters/page-matcher.ts
  function matchSupportedPage(url) {
    if (url.hostname === "search.bilibili.com") {
      return "search";
    }
    if (url.hostname === "www.bilibili.com" && url.pathname.startsWith("/video/")) {
      return "video";
    }
    if (url.hostname === "www.bilibili.com" && (url.pathname === "/" || url.pathname === "")) {
      return "home";
    }
    return "unsupported";
  }

  // src/content/adapters/search-adapter.ts
  var SearchAdapter = class extends VideoCardAdapter {
    name = "搜索页";
    source = "search";
    cardSelectors = SITE_SELECTORS.searchVideoCards;
  };

  // src/content/adapters/video-page-adapter.ts
  var INITIAL_COMMENT_BATCH_SIZE = 50;
  var INITIAL_COMMENT_BATCH_TIMEOUT_MS = 1200;
  var VideoPageAdapter = class extends BaseAdapter {
    name = "视频页";
    fingerprints = /* @__PURE__ */ new WeakMap();
    initialBatch = /* @__PURE__ */ new Set();
    initialBatchComplete = false;
    initialBatchTimer = null;
    danmakuController;
    constructor(context, danmakuController) {
      super(context);
      this.danmakuController = danmakuController;
    }
    start() {
      super.start();
      this.danmakuController.start();
    }
    destroy() {
      this.cancelInitialBatch();
      this.danmakuController.destroy();
      super.destroy();
    }
    rescan() {
      this.fingerprints = /* @__PURE__ */ new WeakMap();
      super.rescan();
    }
    scan(root) {
      const state = this.context.getState();
      if (!state.settings.modules.comments) {
        return;
      }
      const candidates = new Set(queryAll(root, SITE_SELECTORS.commentItems));
      if (root instanceof ShadowRoot && SITE_SELECTORS.commentItems.some((selector) => root.host.matches(selector))) {
        candidates.add(root.host);
      }
      if (root instanceof Element) {
        const ancestor = closestComposed(root, SITE_SELECTORS.commentItems);
        if (ancestor) {
          candidates.add(ancestor);
        }
      }
      const boundaries = new Set([...candidates].map((element) => this.commentBoundary(element)));
      for (const element of boundaries) {
        if (!(element instanceof HTMLElement)) {
          continue;
        }
        if (!this.initialBatchComplete) {
          if (!parseCommentElement(element)) {
            continue;
          }
          this.queueInitialComment(element);
          continue;
        }
        this.evaluateAndRender(element, state);
      }
    }
    queueInitialComment(element) {
      if (this.initialBatch.has(element)) {
        return;
      }
      this.initialBatch.add(element);
      this.context.renderer.stageComment(element);
      if (this.initialBatchTimer === null) {
        this.initialBatchTimer = window.setTimeout(
          () => this.flushInitialBatch(),
          INITIAL_COMMENT_BATCH_TIMEOUT_MS
        );
      }
      if (this.initialBatch.size >= INITIAL_COMMENT_BATCH_SIZE) {
        this.flushInitialBatch();
      }
    }
    flushInitialBatch() {
      if (this.initialBatchComplete) {
        return;
      }
      this.initialBatchComplete = true;
      if (this.initialBatchTimer !== null) {
        window.clearTimeout(this.initialBatchTimer);
        this.initialBatchTimer = null;
      }
      const state = this.context.getState();
      for (const element of this.initialBatch) {
        this.evaluateAndRender(element, state);
      }
      this.initialBatch.clear();
    }
    cancelInitialBatch() {
      if (this.initialBatchTimer !== null) {
        window.clearTimeout(this.initialBatchTimer);
        this.initialBatchTimer = null;
      }
      for (const element of this.initialBatch) {
        this.context.renderer.unstageComment(element);
      }
      this.initialBatch.clear();
    }
    evaluateAndRender(element, state = this.context.getState()) {
      const item = parseCommentElement(element);
      if (!item) {
        this.context.renderer.unstageComment(element);
        return;
      }
      const fingerprint = [
        item.text,
        item.hasAtMention ? "1" : "0",
        item.authorId ?? "",
        item.authorName ?? "",
        item.authorLevel ?? "",
        item.likeCount ?? "",
        item.publishTimestamp ?? "",
        item.replyDepth
      ].join("");
      if (this.fingerprints.get(element) === fingerprint) {
        this.context.renderer.unstageComment(element);
        return;
      }
      this.fingerprints.set(element, fingerprint);
      const result = evaluateComment(item, state);
      this.context.renderer.applyComment(item, result);
    }
    commentBoundary(element) {
      if (!element.matches("bili-comment-renderer")) {
        return element;
      }
      return closestComposed(
        element,
        ["bili-comment-reply-renderer", "bili-comment-thread-renderer"],
        false
      ) ?? element;
    }
  };

  // src/content/controllers/danmaku-controller.ts
  var DanmakuController = class {
    getState;
    retryTimer = null;
    verifyTimer = null;
    destroyed = false;
    attempt = 0;
    manualAllowedVideo = "";
    status = "unknown";
    constructor(getState) {
      this.getState = getState;
    }
    start() {
      this.destroyed = false;
      this.attempt = 0;
      this.manualAllowedVideo = "";
      this.status = "unknown";
      document.addEventListener("click", this.handleTrustedClick, true);
      this.schedule(0);
    }
    destroy() {
      this.destroyed = true;
      document.removeEventListener("click", this.handleTrustedClick, true);
      if (this.retryTimer !== null) {
        window.clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }
      if (this.verifyTimer !== null) {
        window.clearTimeout(this.verifyTimer);
        this.verifyTimer = null;
      }
    }
    getStatus() {
      return this.status;
    }
    handleTrustedClick = (event) => {
      if (!event.isTrusted || !(event.target instanceof Element)) {
        return;
      }
      const toggle = closestAny(event.target, SITE_SELECTORS.danmakuToggles);
      if (!toggle) {
        return;
      }
      window.setTimeout(() => {
        const current = this.readToggle(toggle);
        if (current === true && this.getState().settings.danmaku.allowManualEnableForCurrentVideo) {
          this.manualAllowedVideo = this.currentVideoKey();
          this.status = "open";
        }
      }, 150);
    };
    schedule(delay) {
      if (this.destroyed) {
        return;
      }
      this.retryTimer = window.setTimeout(() => this.tryClose(), delay);
    }
    tryClose() {
      if (this.destroyed) {
        return;
      }
      const settings = this.getState().settings;
      if (!settings.modules.danmaku || !settings.danmaku.defaultOff) {
        this.status = "not-applicable";
        return;
      }
      if (this.manualAllowedVideo === this.currentVideoKey()) {
        this.status = "open";
        return;
      }
      const toggle = queryDeepFirst(document, SITE_SELECTORS.danmakuToggles);
      if (!toggle) {
        this.status = "not-found";
        this.retry();
        return;
      }
      const open = this.readToggle(toggle);
      if (open === false) {
        this.status = "closed";
        return;
      }
      if (open === null) {
        this.status = "unknown";
        this.retry();
        return;
      }
      toggle.click();
      this.verifyTimer = window.setTimeout(() => {
        const state = this.readToggle(toggle);
        if (state === false) {
          this.status = "closed";
        } else {
          this.status = state === true ? "open" : "unknown";
          this.retry();
        }
      }, 120);
    }
    retry() {
      const delays = [100, 250, 500, 1e3, 2e3, 3e3, 3e3];
      const delay = delays[this.attempt];
      this.attempt += 1;
      if (delay !== void 0) {
        this.schedule(delay);
      }
    }
    readToggle(element) {
      const input = element instanceof HTMLInputElement ? element : element.querySelector('input[type="checkbox"]');
      if (input instanceof HTMLInputElement) {
        return input.checked;
      }
      const ariaChecked = element.getAttribute("aria-checked");
      if (ariaChecked === "true" || ariaChecked === "false") {
        return ariaChecked === "true";
      }
      const dataChecked = element.getAttribute("data-checked");
      if (dataChecked === "true" || dataChecked === "false") {
        return dataChecked === "true";
      }
      if (element.classList.contains("bui-checkbox-checked") || element.classList.contains("active") || element.classList.contains("on")) {
        return true;
      }
      if (element.classList.contains("bui-checkbox-unchecked") || element.classList.contains("closed") || element.classList.contains("off")) {
        return false;
      }
      return null;
    }
    currentVideoKey() {
      return `${location.pathname}${location.search}`;
    }
  };

  // src/content/renderers/filter-renderer.ts
  var FILTER_STYLE_PROPERTIES = [
    "display",
    "filter",
    "opacity",
    "pointer-events",
    "user-select"
  ];
  var FilterRenderer = class {
    constructor(onNewFilter) {
      this.onNewFilter = onNewFilter;
    }
    records = /* @__PURE__ */ new Map();
    pendingComments = /* @__PURE__ */ new Map();
    revealed = /* @__PURE__ */ new WeakSet();
    counted = /* @__PURE__ */ new WeakSet();
    stageComment(element) {
      if (this.revealed.has(element) || this.records.has(element) || this.pendingComments.has(element)) {
        return;
      }
      this.pendingComments.set(element, {
        value: element.style.getPropertyValue("visibility"),
        priority: element.style.getPropertyPriority("visibility")
      });
      element.classList.add("bc-comment-pending");
      element.style.setProperty("visibility", "hidden", "important");
    }
    unstageComment(element) {
      const pending = this.pendingComments.get(element);
      if (!pending) {
        return;
      }
      if (pending.value) {
        element.style.setProperty("visibility", pending.value, pending.priority);
      } else {
        element.style.removeProperty("visibility");
      }
      element.classList.remove("bc-comment-pending");
      this.pendingComments.delete(element);
    }
    applyComment(item, result) {
      if (result.action === "show" || this.revealed.has(item.element)) {
        this.restore(item.element);
        return;
      }
      const hiddenResult = {
        ...result,
        action: "hide"
      };
      this.apply(item.element, "comment", hiddenResult);
    }
    applyVideoCard(card, result) {
      if (result.action === "show" || this.revealed.has(card.element)) {
        this.restore(card.element);
        return;
      }
      const hiddenResult = {
        ...result,
        action: "hide"
      };
      this.apply(
        card.element,
        "video",
        hiddenResult
      );
    }
    restoreAll(markRevealed = false) {
      for (const element of [...this.records.keys()]) {
        if (markRevealed) {
          this.revealed.add(element);
        }
        this.restore(element);
      }
      for (const element of [...this.pendingComments.keys()]) {
        if (markRevealed) {
          this.revealed.add(element);
        }
        this.unstageComment(element);
      }
    }
    showAllTemporarily() {
      this.restoreAll(true);
    }
    getCounts() {
      let commentsFiltered = 0;
      let videosFiltered = 0;
      for (const record of this.records.values()) {
        if (record.kind === "comment") {
          commentsFiltered += 1;
        } else {
          videosFiltered += 1;
        }
      }
      return { commentsFiltered, videosFiltered };
    }
    apply(element, kind, result) {
      const wasFiltered = this.records.has(element);
      this.restore(element);
      const inlineStyles = /* @__PURE__ */ new Map();
      for (const property of FILTER_STYLE_PROPERTIES) {
        inlineStyles.set(property, {
          value: element.style.getPropertyValue(property),
          priority: element.style.getPropertyPriority(property)
        });
      }
      element.classList.add("bc-filtered-element");
      element.classList.add(result.action === "blur" ? "bc-filter-blur" : "bc-filter-collapse");
      element.dataset.bcFilterAction = result.action;
      if (result.action === "blur") {
        element.style.setProperty("filter", "blur(9px) saturate(0.65)", "important");
        element.style.setProperty("opacity", "0.62", "important");
        element.style.setProperty("pointer-events", "none", "important");
        element.style.setProperty("user-select", "none", "important");
      } else {
        element.style.setProperty("display", "none", "important");
      }
      this.records.set(element, { element, kind, inlineStyles });
      if (!wasFiltered && !this.counted.has(element)) {
        this.counted.add(element);
        this.onNewFilter?.(kind);
      }
    }
    restore(element) {
      this.unstageComment(element);
      const record = this.records.get(element);
      element.classList.remove("bc-filtered-element", "bc-filter-collapse", "bc-filter-blur");
      delete element.dataset.bcFilterAction;
      if (record) {
        for (const [property, previous] of record.inlineStyles) {
          if (previous.value) {
            element.style.setProperty(property, previous.value, previous.priority);
          } else {
            element.style.removeProperty(property);
          }
        }
      }
      this.records.delete(element);
    }
  };

  // src/content/route-observer.ts
  var RouteObserver = class {
    callback;
    timer = null;
    currentHref = location.href;
    constructor(callback) {
      this.callback = callback;
    }
    start() {
      window.addEventListener("popstate", this.check);
      window.addEventListener("hashchange", this.check);
      this.timer = window.setInterval(this.check, 300);
    }
    destroy() {
      window.removeEventListener("popstate", this.check);
      window.removeEventListener("hashchange", this.check);
      if (this.timer !== null) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
    }
    check = () => {
      if (location.href === this.currentHref) {
        return;
      }
      this.currentHref = location.href;
      this.callback(new URL(this.currentHref));
    };
  };

  // src/content/bootstrap.ts
  var BiliCleanApp = class {
    state = cloneDefaultState();
    renderer = new FilterRenderer((kind) => this.queueFilterStat(kind));
    routeObserver = new RouteObserver(() => this.rebind());
    adapter = null;
    danmakuController = null;
    pauseTimer = null;
    statsTimer = null;
    pendingCommentStats = 0;
    pendingVideoStats = 0;
    async start() {
      try {
        const response = await chrome.runtime.sendMessage({ type: "BC_GET_STATE" });
        if (response && typeof response === "object" && "ok" in response && response.ok && "state" in response) {
          this.state = sanitizeStoredState(response.state);
        }
      } catch {
        this.state = cloneDefaultState();
      }
      chrome.storage.onChanged.addListener(this.handleStorageChange);
      chrome.runtime.onMessage.addListener(this.handleMessage);
      window.addEventListener("pagehide", () => this.flushFilterStats());
      this.routeObserver.start();
      this.schedulePauseWake();
      this.rebind();
    }
    handleStorageChange = (changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEY]?.newValue) {
        return;
      }
      const nextState = sanitizeStoredState(changes[STORAGE_KEY].newValue);
      const filteringConfigurationChanged = JSON.stringify({
        settings: this.state.settings,
        rules: this.state.rules,
        userLists: this.state.userLists
      }) !== JSON.stringify({
        settings: nextState.settings,
        rules: nextState.rules,
        userLists: nextState.userLists
      });
      this.state = nextState;
      if (!filteringConfigurationChanged) {
        return;
      }
      this.schedulePauseWake();
      this.rebind();
    };
    queueFilterStat(kind) {
      if (!this.state.settings.privacy.localStatsEnabled) {
        return;
      }
      if (kind === "comment") {
        this.pendingCommentStats += 1;
      } else {
        this.pendingVideoStats += 1;
      }
      if (this.statsTimer === null) {
        this.statsTimer = window.setTimeout(() => this.flushFilterStats(), 250);
      }
    }
    flushFilterStats() {
      if (this.statsTimer !== null) {
        window.clearTimeout(this.statsTimer);
        this.statsTimer = null;
      }
      const commentsBlocked = this.pendingCommentStats;
      const videosBlocked = this.pendingVideoStats;
      this.pendingCommentStats = 0;
      this.pendingVideoStats = 0;
      if (commentsBlocked === 0 && videosBlocked === 0) {
        return;
      }
      void chrome.runtime.sendMessage({
        type: "BC_RECORD_FILTERS",
        commentsBlocked,
        videosBlocked
      }).catch(() => void 0);
    }
    handleMessage = (message, _sender, sendResponse) => {
      if (!message || typeof message !== "object" || !("type" in message)) {
        return false;
      }
      switch (message.type) {
        case "BC_GET_PAGE_STATUS":
          sendResponse({ ok: true, status: this.getStatus() });
          return false;
        case "BC_SHOW_ALL_ON_PAGE":
          this.renderer.showAllTemporarily();
          sendResponse({ ok: true });
          return false;
        case "BC_RESCAN_PAGE":
          this.adapter?.rescan();
          sendResponse({ ok: true });
          return false;
        default:
          return false;
      }
    };
    rebind() {
      this.adapter?.destroy();
      this.adapter = null;
      this.danmakuController = null;
      this.renderer.restoreAll(false);
      if (!isCleaningActive(this.state.settings)) {
        return;
      }
      const page = matchSupportedPage(new URL(location.href));
      const context = {
        getState: () => this.state,
        renderer: this.renderer
      };
      if (page === "video") {
        const controller = new DanmakuController(() => this.state);
        this.danmakuController = controller;
        this.adapter = new VideoPageAdapter(context, controller);
      } else if (page === "home") {
        this.adapter = new HomeAdapter(context);
      } else if (page === "search") {
        this.adapter = new SearchAdapter(context);
      }
      this.adapter?.start();
    }
    schedulePauseWake() {
      if (this.pauseTimer !== null) {
        window.clearTimeout(this.pauseTimer);
        this.pauseTimer = null;
      }
      const pausedUntil = this.state.settings.pausedUntil;
      if (pausedUntil !== null && pausedUntil > Date.now()) {
        const delay = Math.min(pausedUntil - Date.now() + 50, 2147e6);
        this.pauseTimer = window.setTimeout(() => this.rebind(), delay);
      }
    }
    getStatus() {
      const page = matchSupportedPage(new URL(location.href));
      const counts = this.renderer.getCounts();
      const inScope = page !== "unsupported";
      const danmaku = page === "video" ? this.danmakuController?.getStatus() ?? "unknown" : "not-applicable";
      return {
        inScope,
        enabled: inScope && isCleaningActive(this.state.settings),
        adapter: this.adapter?.name ?? (inScope ? "已暂停" : "当前页面暂不支持"),
        ...counts,
        danmaku,
        note: inScope ? void 0 : "MVP 0.1 支持视频页、首页和搜索页。"
      };
    }
  };
  var app = new BiliCleanApp();
  void app.start();
})();
