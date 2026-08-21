import test from "node:test";
import assert from "node:assert/strict";

test("后台入口注册监听器并完成状态读写", async (context) => {
  const values = {};
  let installedListener = null;
  let messageListener = null;

  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    runtime: {
      id: "biliclean-test",
      onInstalled: {
        addListener(listener) {
          installedListener = listener;
        }
      },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        }
      }
    },
    storage: {
      local: {
        async get(key) {
          return { [key]: values[key] };
        },
        async set(update) {
          Object.assign(values, structuredClone(update));
        }
      }
    }
  };

  context.after(() => {
    globalThis.chrome = previousChrome;
  });

  await import(`../src/background/service-worker.js?smoke=${Date.now()}`);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(typeof installedListener, "function");
  assert.equal(typeof messageListener, "function");

  const send = (message) => new Promise((resolve) => {
    const keepChannelOpen = messageListener(message, { id: "biliclean-test" }, resolve);
    assert.equal(keepChannelOpen, true);
  });

  const initial = await send({ type: "BC_GET_STATE" });
  assert.equal(initial.ok, true);
  assert.equal(initial.state.settings.schemaVersion, 3);

  const changedSettings = structuredClone(initial.state.settings);
  changedSettings.videos.minViewCount = 12_345;
  const saved = await send({ type: "BC_SAVE_SETTINGS", settings: changedSettings });
  assert.equal(saved.ok, true);
  assert.equal(saved.state.settings.videos.minViewCount, 12_345);

  const recorded = await send({
    type: "BC_RECORD_FILTERS",
    commentsBlocked: 2,
    videosBlocked: 3
  });
  assert.equal(recorded.ok, true);
  assert.equal(recorded.state.stats.commentsBlocked, 2);
  assert.equal(recorded.state.stats.videosBlocked, 3);
});
