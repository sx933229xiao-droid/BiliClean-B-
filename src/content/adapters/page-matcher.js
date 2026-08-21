// Recovered from BiliClean v0.1.4 distribution module: src/content/adapters/page-matcher.ts
export function matchSupportedPage(url) {
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
