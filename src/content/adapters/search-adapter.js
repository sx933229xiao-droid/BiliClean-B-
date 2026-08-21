// Recovered from BiliClean v0.1.4 distribution module: src/content/adapters/search-adapter.ts
import { SITE_SELECTORS } from "./selectors.js";
import { VideoCardAdapter } from "./video-card-adapter.js";

export var SearchAdapter = class extends VideoCardAdapter {
  name = "搜索页";
  source = "search";
  cardSelectors = SITE_SELECTORS.searchVideoCards;
};
