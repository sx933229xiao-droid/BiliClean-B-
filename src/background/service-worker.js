// Recovered from BiliClean v0.1.4 distribution module: src/background/service-worker.ts
import { STORAGE_KEY, cloneDefaultState, applyCleanModePreset } from "../shared/defaults.js";
import { isBackgroundRequest } from "../shared/messages.js";
import { validateImportBundle, makeExportBundle } from "../shared/validation.js";
import { getState, saveState, saveSettings, saveRules, saveUserLists, recordFilterStats, resetStats, resetState } from "../storage/settings-repository.js";

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    const state = await getState();
    if (details.reason === "update" && details.previousVersion === "0.1.0" && state.settings.mode === "strict") {
      applyCleanModePreset(state.settings, "strict");
      await saveState(state);
    }
  })();
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isBackgroundRequest(message)) {
    return false;
  }
  if (sender.id && sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: "拒绝来自未知扩展的消息。" });
    return false;
  }
  void (async () => {
    switch (message.type) {
      case "BC_GET_STATE":
        return { ok: true, state: await getState() };
      case "BC_SAVE_SETTINGS":
        return { ok: true, state: await saveSettings(message.settings) };
      case "BC_SAVE_RULES":
        return { ok: true, state: await saveRules(message.rules) };
      case "BC_SAVE_LISTS":
        return { ok: true, state: await saveUserLists(message.userLists) };
      case "BC_RECORD_FILTERS":
        return {
          ok: true,
          state: await recordFilterStats({
            commentsBlocked: message.commentsBlocked,
            videosBlocked: message.videosBlocked
          })
        };
      case "BC_RESET_STATS":
        return { ok: true, state: await resetStats() };
      case "BC_EXPORT_STATE":
        return { ok: true, bundle: makeExportBundle(await getState()) };
      case "BC_IMPORT_STATE":
        return { ok: true, state: await saveState(validateImportBundle(message.bundle)) };
      case "BC_RESET_STATE":
        return { ok: true, state: await resetState() };
      default:
        return { ok: false, error: "未知消息。" };
    }
  })().then(sendResponse).catch((error) => {
    const text = error instanceof Error ? error.message : "未知错误";
    sendResponse({ ok: false, error: text });
  });
  return true;
});
void getState().catch(() => {
  void chrome.storage.local.set({ [STORAGE_KEY]: cloneDefaultState() });
});
