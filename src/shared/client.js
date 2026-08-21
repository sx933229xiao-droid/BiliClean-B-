// Recovered from BiliClean v0.1.4 distribution module: src/shared/client.ts
export async function sendBackgroundRequest(request) {
  return chrome.runtime.sendMessage(request);
}
export async function sendContentRequest(tabId, request) {
  return chrome.tabs.sendMessage(tabId, request);
}
