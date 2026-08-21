// Recovered from BiliClean v0.1.4 distribution module: src/storage/settings-repository.ts
import { STORAGE_KEY, cloneDefaultState } from "../shared/defaults.js";
import { sanitizeSettings, sanitizeRules, sanitizeUserLists, sanitizeStoredState } from "../shared/validation.js";

export var writeQueue = Promise.resolve();
export function enqueueWrite(operation) {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(() => void 0, () => void 0);
  return result;
}
export async function writeStateDirect(state) {
  const sanitized = sanitizeStoredState(state);
  await chrome.storage.local.set({ [STORAGE_KEY]: sanitized });
  return sanitized;
}
export async function getState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (raw === void 0) {
    const initial = cloneDefaultState();
    await chrome.storage.local.set({ [STORAGE_KEY]: initial });
    return initial;
  }
  const sanitized = sanitizeStoredState(raw);
  if (JSON.stringify(raw) !== JSON.stringify(sanitized)) {
    await chrome.storage.local.set({ [STORAGE_KEY]: sanitized });
  }
  return sanitized;
}
export async function saveState(state) {
  return enqueueWrite(() => writeStateDirect(state));
}
export async function saveSettings(settings) {
  return enqueueWrite(async () => {
    const state = await getState();
    state.settings = sanitizeSettings(settings);
    return writeStateDirect(state);
  });
}
export async function saveRules(rules) {
  return enqueueWrite(async () => {
    const state = await getState();
    state.rules = sanitizeRules(rules);
    return writeStateDirect(state);
  });
}
export async function saveUserLists(userLists) {
  return enqueueWrite(async () => {
    const state = await getState();
    state.userLists = sanitizeUserLists(userLists);
    return writeStateDirect(state);
  });
}
export async function recordFilterStats(delta) {
  return enqueueWrite(async () => {
    const state = await getState();
    if (!state.settings.privacy.localStatsEnabled) {
      return state;
    }
    state.stats.commentsBlocked = Math.min(
      Number.MAX_SAFE_INTEGER,
      state.stats.commentsBlocked + Math.max(0, Math.trunc(delta.commentsBlocked))
    );
    state.stats.videosBlocked = Math.min(
      Number.MAX_SAFE_INTEGER,
      state.stats.videosBlocked + Math.max(0, Math.trunc(delta.videosBlocked))
    );
    return writeStateDirect(state);
  });
}
export async function resetStats() {
  return enqueueWrite(async () => {
    const state = await getState();
    state.stats = {
      commentsBlocked: 0,
      videosBlocked: 0,
      startedAt: Date.now()
    };
    return writeStateDirect(state);
  });
}
export async function resetState() {
  return enqueueWrite(() => writeStateDirect(cloneDefaultState()));
}
