// Recovered from BiliClean v0.1.4 distribution module: src/shared/messages.ts
export var BACKGROUND_TYPES = /* @__PURE__ */ new Set([
  "BC_GET_STATE",
  "BC_SAVE_SETTINGS",
  "BC_SAVE_RULES",
  "BC_SAVE_LISTS",
  "BC_RECORD_FILTERS",
  "BC_RESET_STATS",
  "BC_EXPORT_STATE",
  "BC_IMPORT_STATE",
  "BC_RESET_STATE"
]);
export function isBackgroundRequest(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const type = value.type;
  if (typeof type !== "string" || !BACKGROUND_TYPES.has(type)) {
    return false;
  }
  if (type === "BC_RECORD_FILTERS") {
    const request = value;
    return typeof request.commentsBlocked === "number" && Number.isFinite(request.commentsBlocked) && request.commentsBlocked >= 0 && request.commentsBlocked <= 1e4 && typeof request.videosBlocked === "number" && Number.isFinite(request.videosBlocked) && request.videosBlocked >= 0 && request.videosBlocked <= 1e4;
  }
  return true;
}
