const LOG_PREFIX = "[chatflow:arxiv-split-view]";
const CHATGPT_URL = "https://chatgpt.com/";
const RECENT_TAB_WINDOW_MS = 3000;
const CANDIDATE_TTL_MS = 10000;
const RETRY_DELAYS_MS = [0, 80, 200, 500, 1000, 2000];

// tabId -> { createdAt, windowId, initialUrl, seenSplitViewId, processed }
const recentTabs = new Map();
const processedTabIds = new Set();
const retryTimers = new Map();

function log(event, details = {}) {
  console.log(`${LOG_PREFIX} ${event}`, details);
}

function tabUrl(tab) {
  return tab?.pendingUrl || tab?.url || "";
}

function isArxivPdfUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.toLowerCase() === "arxiv.org" &&
      parsed.pathname.startsWith("/pdf/")
    );
  } catch {
    return false;
  }
}

function isChatGptUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.toLowerCase() === "chatgpt.com"
    );
  } catch {
    return false;
  }
}

function isBlankNewTabUrl(url) {
  if (!url) return true;

  const normalized = url.toLowerCase();
  return (
    normalized === "about:blank" ||
    normalized === "chrome://newtab/" ||
    normalized === "chrome://new-tab-page/" ||
    normalized === "chrome://tab-search.top-chrome/split_new_tab_page.html" ||
    normalized === "edge://newtab/"
  );
}

function hasValidSplitViewId(tab) {
  return (
    Number.isInteger(tab?.splitViewId) &&
    tab.splitViewId !== -1 &&
    tab.splitViewId !== chrome.tabs.SPLIT_VIEW_ID_NONE
  );
}

function summarizeTab(tab) {
  return {
    id: tab?.id,
    windowId: tab?.windowId,
    url: tab?.url,
    pendingUrl: tab?.pendingUrl,
    splitViewId: tab?.splitViewId,
    active: tab?.active,
  };
}

function skip(tab, reason, details = {}) {
  log("[skip]", { tabId: tab?.id, reason, ...details });
}

function clearRetryTimers(tabId) {
  const timers = retryTimers.get(tabId) || [];
  for (const timer of timers) clearTimeout(timer);
  retryTimers.delete(tabId);
}

function cleanupExpiredCandidates() {
  const cutoff = Date.now() - CANDIDATE_TTL_MS;

  for (const [tabId, candidate] of recentTabs) {
    if (candidate.createdAt < cutoff) {
      recentTabs.delete(tabId);
      processedTabIds.delete(tabId);
      clearRetryTimers(tabId);
    }
  }
}

async function evaluateCandidate(tabId, trigger) {
  cleanupExpiredCandidates();

  const candidate = recentTabs.get(tabId);
  if (!candidate) return;

  if (candidate.processed || processedTabIds.has(tabId)) return;

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (error) {
    recentTabs.delete(tabId);
    clearRetryTimers(tabId);
    skip({ id: tabId }, "tab no longer exists", { trigger, error: String(error) });
    return;
  }

  if (Date.now() - candidate.createdAt > RECENT_TAB_WINDOW_MS) {
    skip(tab, "tab is outside the recent-creation window", { trigger });
    return;
  }

  if (tab.windowId !== candidate.windowId) {
    skip(tab, "tab moved to another window", { trigger });
    return;
  }

  if (!hasValidSplitViewId(tab)) return;

  candidate.seenSplitViewId = tab.splitViewId;

  const targetUrl = tabUrl(tab);
  if (isChatGptUrl(targetUrl)) {
    candidate.processed = true;
    processedTabIds.add(tabId);
    clearRetryTimers(tabId);
    skip(tab, "target is already ChatGPT", { trigger });
    return;
  }

  if (!isBlankNewTabUrl(targetUrl)) {
    skip(tab, "new Split View tab is not blank; preserving user page", {
      trigger,
      targetUrl,
    });
    return;
  }

  let splitTabs;
  try {
    splitTabs = await chrome.tabs.query({
      windowId: tab.windowId,
      splitViewId: tab.splitViewId,
    });
  } catch (error) {
    skip(tab, "failed to query Split View", { trigger, error: String(error) });
    return;
  }

  log("[splitView detected]", {
    trigger,
    splitViewId: tab.splitViewId,
    tabs: splitTabs.map(summarizeTab),
  });

  const sourceTab = splitTabs.find(
    (peer) => peer.id !== tab.id && isArxivPdfUrl(tabUrl(peer)),
  );

  if (!sourceTab) {
    skip(tab, "no arXiv PDF in the same Split View", {
      trigger,
      splitViewId: tab.splitViewId,
    });
    return;
  }

  // Mark first so overlapping tab events cannot issue duplicate navigations.
  candidate.processed = true;
  processedTabIds.add(tabId);
  clearRetryTimers(tabId);

  log("[matched arxiv]", {
    sourceTabId: sourceTab.id,
    sourceUrl: tabUrl(sourceTab),
    targetTabId: tab.id,
  });

  try {
    await chrome.tabs.update(tab.id, { url: CHATGPT_URL });
    log("[update to ChatGPT]", { targetTabId: tab.id, url: CHATGPT_URL });
  } catch (error) {
    candidate.processed = false;
    processedTabIds.delete(tabId);
    log("[update failed]", { targetTabId: tab.id, error: String(error) });
  }
}

function scheduleEvaluation(tabId, trigger) {
  if (!recentTabs.has(tabId)) return;

  clearRetryTimers(tabId);
  const timers = RETRY_DELAYS_MS.map((delay) =>
    setTimeout(() => void evaluateCandidate(tabId, `${trigger}+${delay}ms`), delay),
  );
  retryTimers.set(tabId, timers);
}

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id == null) return;

  recentTabs.set(tab.id, {
    createdAt: Date.now(),
    windowId: tab.windowId,
    initialUrl: tabUrl(tab),
    seenSplitViewId: tab.splitViewId,
    processed: false,
  });

  log("[onCreated]", summarizeTab(tab));
  scheduleEvaluation(tab.id, "onCreated");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  log("[onUpdated]", {
    tabId,
    changeInfo,
    tab: summarizeTab(tab),
  });

  if (recentTabs.has(tabId)) {
    scheduleEvaluation(tabId, "onUpdated");
  }
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  log("[onActivated]", { tabId, windowId });
  if (recentTabs.has(tabId)) scheduleEvaluation(tabId, "onActivated");
});

chrome.tabs.onRemoved.addListener((tabId) => {
  recentTabs.delete(tabId);
  processedTabIds.delete(tabId);
  clearRetryTimers(tabId);
});

log("[service worker started]", {
  target: CHATGPT_URL,
  recentTabWindowMs: RECENT_TAB_WINDOW_MS,
});
