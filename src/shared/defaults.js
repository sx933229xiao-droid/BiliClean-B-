// Recovered from BiliClean v0.1.4 distribution module: src/shared/defaults.ts
export var STORAGE_KEY = "biliclean.state.v1";
export var DEFAULT_SETTINGS = {
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
export var DEFAULT_STATE = {
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
export function cloneDefaultState() {
  const state = structuredClone(DEFAULT_STATE);
  state.stats.startedAt = Date.now();
  return state;
}
export function applyCleanModePreset(settings, mode) {
  settings.mode = mode;
  if (mode === "light" || mode === "standard") {
    settings.comments.lowLikeEnabled = false;
    settings.comments.maxLowLikeCount = 1;
    settings.comments.requireCombinedWeakSignals = true;
    settings.comments.minUserLevelEnabled = false;
    settings.comments.minUserLevel = 1;
    settings.comments.newCommentGraceHours = 24;
  } else if (mode === "strict") {
    settings.comments.lowLikeEnabled = true;
    settings.comments.maxLowLikeCount = 1;
    settings.comments.requireCombinedWeakSignals = false;
    settings.comments.minUserLevelEnabled = false;
    settings.comments.minUserLevel = 1;
    settings.comments.newCommentGraceHours = 24;
  }
  return settings;
}
export function isCleaningActive(settings, now = Date.now()) {
  return settings.enabled && (settings.pausedUntil === null || settings.pausedUntil <= now);
}
