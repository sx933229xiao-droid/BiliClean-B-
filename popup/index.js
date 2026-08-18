"use strict";
(() => {
  // src/shared/client.ts
  async function sendBackgroundRequest(request) {
    return chrome.runtime.sendMessage(request);
  }
  async function sendContentRequest(tabId, request) {
    return chrome.tabs.sendMessage(tabId, request);
  }

  // src/shared/defaults.ts
  function applyCleanModePreset(settings, mode) {
    settings.mode = mode;
    if (mode === "strict") {
      settings.comments.lowLikeEnabled = true;
      settings.comments.maxLowLikeCount = Math.max(1, settings.comments.maxLowLikeCount);
      settings.comments.requireCombinedWeakSignals = false;
    }
    return settings;
  }

  // src/popup/index.ts
  function element(id) {
    const found = document.getElementById(id);
    if (!found) {
      throw new Error(`缺少界面元素：${id}`);
    }
    return found;
  }
  var masterToggle = element("master-toggle");
  var modeSelect = element("mode-select");
  var commentsToggle = element("comments-toggle");
  var videosToggle = element("videos-toggle");
  var danmakuToggle = element("danmaku-toggle");
  var lowLikeToggle = element("low-like-toggle");
  var lowLikeThreshold = element("low-like-threshold");
  var statusDot = element("status-dot");
  var statusTitle = element("status-title");
  var statusDetail = element("status-detail");
  var commentCount = element("comment-count");
  var videoCount = element("video-count");
  var danmakuState = element("danmaku-state");
  var showAllButton = element("show-all-button");
  var rescanButton = element("rescan-button");
  var resumeButton = element("resume-button");
  var state = null;
  var activeTabId = null;
  async function load() {
    const response = await sendBackgroundRequest({ type: "BC_GET_STATE" });
    if (!response.ok || !("state" in response)) {
      throw new Error(response.ok ? "设置响应无效。" : response.error);
    }
    state = response.state;
    renderSettings();
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tabs[0]?.id ?? null;
    await refreshPageStatus();
  }
  function renderSettings() {
    if (!state) {
      return;
    }
    const settings = state.settings;
    masterToggle.checked = settings.enabled;
    modeSelect.value = settings.mode;
    commentsToggle.checked = settings.modules.comments;
    videosToggle.checked = settings.modules.videos;
    danmakuToggle.checked = settings.modules.danmaku && settings.danmaku.defaultOff;
    lowLikeToggle.checked = settings.comments.lowLikeEnabled && !settings.comments.requireCombinedWeakSignals;
    lowLikeThreshold.value = String(settings.comments.maxLowLikeCount);
    const paused = settings.pausedUntil !== null && settings.pausedUntil > Date.now();
    resumeButton.style.display = paused ? "inline-flex" : "none";
  }
  async function saveSettings() {
    if (!state) {
      return;
    }
    const response = await sendBackgroundRequest({
      type: "BC_SAVE_SETTINGS",
      settings: state.settings
    });
    if (!response.ok || !("state" in response)) {
      throw new Error(response.ok ? "设置响应无效。" : response.error);
    }
    state = response.state;
    renderSettings();
    await new Promise((resolve) => window.setTimeout(resolve, 80));
    await refreshPageStatus();
  }
  async function refreshPageStatus() {
    let status = null;
    if (activeTabId !== null) {
      try {
        const response = await sendContentRequest(activeTabId, { type: "BC_GET_PAGE_STATUS" });
        if (response.ok && "status" in response) {
          status = response.status;
        }
      } catch {
        status = null;
      }
    }
    renderPageStatus(status);
  }
  function renderPageStatus(status) {
    statusDot.className = "status-dot";
    if (!status?.inScope) {
      statusTitle.textContent = "不在作用范围";
      statusDetail.textContent = "打开哔哩哔哩视频页、首页或搜索页后，扩展会自动生效。";
      showAllButton.disabled = true;
      rescanButton.disabled = true;
    } else if (!status.enabled) {
      statusDot.classList.add("paused");
      statusTitle.textContent = "净化已暂停";
      statusDetail.textContent = `当前适配器：${status.adapter}`;
      showAllButton.disabled = true;
      rescanButton.disabled = false;
    } else {
      statusDot.classList.add("active");
      statusTitle.textContent = "已在当前页面生效";
      statusDetail.textContent = `适配器：${status.adapter}。所有判断均在本地完成。`;
      showAllButton.disabled = false;
      rescanButton.disabled = false;
    }
    commentCount.textContent = String(status?.commentsFiltered ?? 0);
    videoCount.textContent = String(status?.videosFiltered ?? 0);
    const labels = {
      closed: "已关",
      open: "已开",
      "not-found": "未识别",
      "not-applicable": "不适用",
      unknown: "检测中"
    };
    danmakuState.textContent = status ? labels[status.danmaku] : "—";
  }
  masterToggle.addEventListener("change", () => {
    if (!state) {
      return;
    }
    state.settings.enabled = masterToggle.checked;
    if (masterToggle.checked) {
      state.settings.pausedUntil = null;
    }
    void saveSettings();
  });
  modeSelect.addEventListener("change", () => {
    if (!state) {
      return;
    }
    applyCleanModePreset(
      state.settings,
      modeSelect.value
    );
    void saveSettings();
  });
  commentsToggle.addEventListener("change", () => {
    if (state) {
      state.settings.modules.comments = commentsToggle.checked;
      void saveSettings();
    }
  });
  videosToggle.addEventListener("change", () => {
    if (state) {
      state.settings.modules.videos = videosToggle.checked;
      void saveSettings();
    }
  });
  danmakuToggle.addEventListener("change", () => {
    if (state) {
      state.settings.modules.danmaku = danmakuToggle.checked;
      state.settings.danmaku.defaultOff = danmakuToggle.checked;
      void saveSettings();
    }
  });
  lowLikeToggle.addEventListener("change", () => {
    if (state) {
      state.settings.comments.lowLikeEnabled = lowLikeToggle.checked;
      if (lowLikeToggle.checked) {
        state.settings.comments.requireCombinedWeakSignals = false;
      }
      void saveSettings();
    }
  });
  lowLikeThreshold.addEventListener("change", () => {
    if (state) {
      const threshold = Number(lowLikeThreshold.value);
      state.settings.comments.maxLowLikeCount = Number.isFinite(threshold) ? Math.min(1e6, Math.max(0, threshold)) : 0;
      state.settings.comments.lowLikeEnabled = true;
      state.settings.comments.requireCombinedWeakSignals = false;
      void saveSettings();
    }
  });
  document.querySelectorAll("[data-pause-minutes]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state) {
        return;
      }
      const minutes = Number(button.dataset.pauseMinutes);
      state.settings.pausedUntil = Date.now() + minutes * 6e4;
      void saveSettings();
    });
  });
  resumeButton.addEventListener("click", () => {
    if (state) {
      state.settings.pausedUntil = null;
      state.settings.enabled = true;
      void saveSettings();
    }
  });
  showAllButton.addEventListener("click", async () => {
    if (activeTabId === null) {
      return;
    }
    await sendContentRequest(activeTabId, { type: "BC_SHOW_ALL_ON_PAGE" });
    await refreshPageStatus();
  });
  rescanButton.addEventListener("click", async () => {
    if (activeTabId === null) {
      return;
    }
    await sendContentRequest(activeTabId, { type: "BC_RESCAN_PAGE" });
    window.setTimeout(() => void refreshPageStatus(), 100);
  });
  element("options-button").addEventListener("click", () => {
    void chrome.runtime.openOptionsPage();
  });
  void load().catch((error) => {
    statusTitle.textContent = "扩展初始化失败";
    statusDetail.textContent = error instanceof Error ? error.message : "未知错误";
    statusDot.classList.add("paused");
  });
})();
