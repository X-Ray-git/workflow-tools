const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  new URL("../src/background/arxiv-split-view.js", `file://${__filename}`),
  "utf8",
);

function event() {
  const listeners = [];
  return {
    addListener(listener) {
      listeners.push(listener);
    },
    emit(...args) {
      for (const listener of listeners) listener(...args);
    },
  };
}

function createHarness(initialTabs) {
  const tabs = new Map(initialTabs.map((tab) => [tab.id, { ...tab }]));
  const updates = [];
  const onCreated = event();
  const onUpdated = event();
  const onActivated = event();
  const onRemoved = event();

  const chrome = {
    tabs: {
      SPLIT_VIEW_ID_NONE: -1,
      onCreated,
      onUpdated,
      onActivated,
      onRemoved,
      async get(tabId) {
        if (!tabs.has(tabId)) throw new Error("No tab");
        return { ...tabs.get(tabId) };
      },
      async query(query) {
        return [...tabs.values()].filter(
          (tab) =>
            tab.windowId === query.windowId &&
            tab.splitViewId === query.splitViewId,
        );
      },
      async update(tabId, change) {
        updates.push({ tabId, change: { ...change } });
        tabs.set(tabId, { ...tabs.get(tabId), ...change });
        return { ...tabs.get(tabId) };
      },
    },
  };

  const immediateTimers = [];
  const context = {
    chrome,
    URL,
    console: { log() {} },
    setTimeout(callback, delay) {
      if (delay === 0) immediateTimers.push(callback);
      return Symbol("timer");
    },
    clearTimeout() {},
  };

  vm.runInNewContext(source, context, {
    filename: "arxiv-split-view.js",
  });

  async function flush() {
    while (immediateTimers.length) {
      immediateTimers.shift()();
      await new Promise(setImmediate);
    }
    await new Promise(setImmediate);
  }

  return { onCreated, onUpdated, tabs, updates, flush };
}

test("navigates a new blank pane beside an arXiv PDF", async () => {
  const sourceTab = {
    id: 1,
    windowId: 10,
    url: "https://arxiv.org/pdf/1706.03762",
    splitViewId: 42,
  };
  const targetTab = {
    id: 2,
    windowId: 10,
    url: "chrome://newtab/",
    splitViewId: 42,
  };
  const harness = createHarness([sourceTab, targetTab]);

  harness.onCreated.emit(targetTab);
  await harness.flush();

  assert.deepEqual(harness.updates, [
    { tabId: 2, change: { url: "https://chatgpt.com/" } },
  ]);
});

test("does not navigate a blank pane beside a non-arXiv page", async () => {
  const sourceTab = {
    id: 1,
    windowId: 10,
    url: "https://example.com/",
    splitViewId: 42,
  };
  const targetTab = {
    id: 2,
    windowId: 10,
    url: "about:blank",
    splitViewId: 42,
  };
  const harness = createHarness([sourceTab, targetTab]);

  harness.onCreated.emit(targetTab);
  await harness.flush();

  assert.deepEqual(harness.updates, []);
});

test("does not navigate beside an arXiv abstract page", async () => {
  const sourceTab = {
    id: 1,
    windowId: 10,
    url: "https://arxiv.org/abs/1706.03762",
    splitViewId: 42,
  };
  const targetTab = {
    id: 2,
    windowId: 10,
    url: "chrome://newtab/",
    splitViewId: 42,
  };
  const harness = createHarness([sourceTab, targetTab]);

  harness.onCreated.emit(targetTab);
  await harness.flush();

  assert.deepEqual(harness.updates, []);
});

test("never overwrites an existing web page beside an arXiv PDF", async () => {
  const sourceTab = {
    id: 1,
    windowId: 10,
    url: "https://arxiv.org/pdf/1706.03762.pdf",
    splitViewId: 42,
  };
  const targetTab = {
    id: 2,
    windowId: 10,
    url: "https://example.com/notes",
    splitViewId: 42,
  };
  const harness = createHarness([sourceTab, targetTab]);

  harness.onCreated.emit(targetTab);
  await harness.flush();

  assert.deepEqual(harness.updates, []);
});

test("does not navigate an ordinary new tab outside Split View", async () => {
  const targetTab = {
    id: 2,
    windowId: 10,
    url: "chrome://newtab/",
    splitViewId: -1,
  };
  const harness = createHarness([targetTab]);

  harness.onCreated.emit(targetTab);
  await harness.flush();

  assert.deepEqual(harness.updates, []);
});

test("reacts when splitViewId appears in a later update", async () => {
  const sourceTab = {
    id: 1,
    windowId: 10,
    url: "https://arxiv.org/pdf/1706.03762",
    splitViewId: 42,
  };
  const targetTab = {
    id: 2,
    windowId: 10,
    url: "chrome://newtab/",
    splitViewId: -1,
  };
  const harness = createHarness([sourceTab, targetTab]);

  harness.onCreated.emit(targetTab);
  await harness.flush();
  assert.deepEqual(harness.updates, []);

  targetTab.splitViewId = 42;
  harness.tabs.set(2, { ...targetTab });
  harness.onUpdated.emit(2, { splitViewId: 42 }, targetTab);
  await harness.flush();

  assert.deepEqual(harness.updates, [
    { tabId: 2, change: { url: "https://chatgpt.com/" } },
  ]);
});

test("recognizes Chrome's native Split View placeholder page", async () => {
  const sourceTab = {
    id: 846289244,
    windowId: 846287707,
    url: "https://arxiv.org/pdf/1706.03762",
    splitViewId: 7,
  };
  const targetTab = {
    id: 846289247,
    windowId: 846287707,
    url: "",
    pendingUrl: "chrome://tab-search.top-chrome/split_new_tab_page.html",
    splitViewId: -1,
  };
  const harness = createHarness([sourceTab, targetTab]);

  harness.onCreated.emit(targetTab);
  await harness.flush();
  assert.deepEqual(harness.updates, []);

  targetTab.splitViewId = 7;
  harness.tabs.set(targetTab.id, { ...targetTab });
  harness.onUpdated.emit(
    targetTab.id,
    { splitViewId: 7 },
    { ...targetTab },
  );
  await harness.flush();

  assert.deepEqual(harness.updates, [
    { tabId: targetTab.id, change: { url: "https://chatgpt.com/" } },
  ]);
});
