// Recovered from BiliClean v0.1.4 distribution module: src/content/adapters/selectors.ts
export var SITE_SELECTORS = {
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
    ".bili-feed-card",
    ".bili-feed4-card",
    '[class*="feed-card"]',
    ".bili-video-card",
    ".feed-card",
    ".video-card",
    ".small-item",
    "[data-bvid]",
    'article[class*="video-card"]'
  ],
  searchVideoCards: [
    ".bili-feed-card",
    ".bili-video-card",
    ".video-item",
    ".video-list-item",
    '.search-all-list article[class*="video-card"]',
    "[data-bvid]",
    '[class*="feed-card"]'
  ],
  feedContainers: [
    ".bili-feed4-layout",
    ".bili-feed4",
    ".container.is-version8",
    ".feed2",
    ".recommended-container",
    ".recommended-container_floor-aside",
    ".video-list",
    ".search-all-list",
    "main.bili-feed4-layout"
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
