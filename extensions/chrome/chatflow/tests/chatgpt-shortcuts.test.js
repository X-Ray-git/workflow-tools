const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  new URL("../src/content/chatgpt-shortcuts.js", `file://${__filename}`),
  "utf8",
);

async function createHarness({
  href = "https://chatgpt.com/c/existing-chat",
  customShortcuts = [],
} = {}) {
  const parsed = new URL(href);
  const listeners = new Map();
  const navigations = [];
  const storage = { chatflowCustomShortcuts: customShortcuts };

  const document = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    getElementById() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };

  const window = {
    location: {
      href: parsed.href,
      origin: parsed.origin,
      pathname: parsed.pathname,
      search: parsed.search,
      assign(target) {
        navigations.push(target);
      },
    },
    setTimeout() {},
  };

  const chrome = {
    storage: {
      local: {
        async get(keys) {
          return Object.fromEntries(keys.map((key) => [key, storage[key]]));
        },
        async set(update) {
          Object.assign(storage, update);
        },
        async remove(key) {
          delete storage[key];
        },
      },
    },
  };

  vm.runInNewContext(source, {
    chrome,
    console: { log() {}, warn() {}, error() {} },
    Date,
    document,
    navigator: { clipboard: { async readText() { return ""; } } },
    window,
  });
  await new Promise(setImmediate);

  function keydown(overrides = {}) {
    const event = {
      defaultPrevented: false,
      isComposing: false,
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      code: "KeyO",
      key: "o",
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {},
      stopImmediatePropagation() {},
      ...overrides,
    };
    listeners.get("keydown")(event);
    return event;
  }

  return { keydown, navigations, storage };
}

test("Cmd+O navigates directly to the ChatGPT root", async () => {
  const harness = await createHarness();

  const event = harness.keydown();

  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(harness.navigations, ["https://chatgpt.com/"]);
});

test("Cmd+O does not navigate when already on a new chat page", async () => {
  const harness = await createHarness({ href: "https://chatgpt.com/" });

  harness.keydown();

  assert.deepEqual(harness.navigations, []);
});

test("a custom new-chat shortcut stores its prompt before navigation", async () => {
  const harness = await createHarness({
    customShortcuts: [
      {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        code: "KeyJ",
        key: "j",
        prompt: "Summarize {{clipboard}}",
        newChat: true,
      },
    ],
  });

  harness.keydown({ code: "KeyJ", key: "j" });
  await new Promise(setImmediate);

  assert.equal(harness.storage.chatflowPendingPrompt.prompt, "Summarize ");
  assert.equal(typeof harness.storage.chatflowPendingPrompt.createdAt, "number");
  assert.deepEqual(harness.navigations, ["https://chatgpt.com/"]);
});
