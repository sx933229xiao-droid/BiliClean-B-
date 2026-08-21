// Recovered from BiliClean v0.1.4 distribution module: src/content/adapters/home-adapter.ts
import { SITE_SELECTORS } from "./selectors.js";
import { VideoCardAdapter } from "./video-card-adapter.js";

export var HomeAdapter = class extends VideoCardAdapter {
  name = "首页";
  source = "home";
  cardSelectors = SITE_SELECTORS.homeVideoCards;
};
