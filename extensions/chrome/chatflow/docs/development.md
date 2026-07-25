# ChatFlow development

## Local installation

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select `extensions/chrome/chatflow`, the directory containing `manifest.json`.

Do not select the repository root.

## Development reload cycle

After changing extension files:

1. Open `chrome://extensions/`.
2. Reload ChatFlow.
3. Refresh existing ChatGPT and arXiv tabs so updated content scripts are injected.
4. Repeat the target workflow.

Uninstalling is normally unnecessary and may clear local extension data.

## Verification

Run the complete suite from the ChatFlow directory:

```sh
node --test tests/*.test.js
```

Run syntax and manifest checks:

```sh
node --check src/background/arxiv-split-view.js
node --check src/content/arxiv-first-visit.js
node --check src/content/chatgpt-shortcuts.js
node --check src/content/chatgpt-pdf-upload.js
node -e 'JSON.parse(require("node:fs").readFileSync("manifest.json", "utf8"))'
```

Before committing, also run from the repository root:

```sh
git diff --check
git status --short
```

## Manual regression checklist

### arXiv first visit

- An unseen `/abs/` page redirects to `/pdf/`.
- A previously visited paper remains on `/abs/`.
- Versioned URLs are treated as the same paper.

### Split View

- arXiv PDF plus a newly created blank Split View pane opens ChatGPT.
- A normal webpage does not trigger ChatGPT.
- An existing webpage is never overwritten.
- An ordinary new tab outside Split View is never changed.

### PDF attachment

- The PDF appears in the exact paired ChatGPT tab.
- The original arXiv PDF remains unchanged.
- A progress or error status appears on ChatGPT.
- No prompt is inserted and no message is sent.
- Other already-open ChatGPT tabs receive no attachment.

### shortcuts

- `Cmd/Ctrl+O` starts a new chat without a full-page reload and never opens an existing conversation.
- `Cmd/Ctrl+O` still opens the ChatGPT root when its native new-chat entry is unavailable.
- `Cmd/Ctrl+I` focuses the composer.
- `Cmd/Ctrl+L` toggles the sidebar.
- `Cmd/Ctrl+Shift+N` toggles temporary chat.
- `Cmd/Ctrl+Shift+,` opens the settings panel.
- A custom prompt and `{{clipboard}}` replacement still work.
- A custom shortcut configured to start a new chat inserts its prompt after the in-app transition.

## Versioning

Update these together for each release:

1. `manifest.json` version.
2. Version displayed in `README.md` installation instructions.
3. A dated entry in `CHANGELOG.md`.

Use patch versions for compatible fixes, minor versions for new personal-toolbox capabilities, and major versions only for intentionally incompatible storage or workflow changes.

## Implementation guidelines

- Keep background, arXiv, ChatGPT shortcut, and ChatGPT upload responsibilities separated.
- Bind automation to exact tab IDs instead of searching globally for a ChatGPT tab.
- Preserve user pages unless a newly created tab is still explicitly blank.
- Prefer stable URLs, IDs, test IDs, and accessibility contracts over positional selectors.
- Do not call undocumented ChatGPT backend endpoints.
- Do not automatically send prompts without a separate explicit product decision.
- Add a defensive test whenever a DOM or event-order regression is fixed.

## Release and commit workflow

ChatFlow is currently loaded directly from the repository rather than packaged for a store. A normal release is:

1. Implement and test the change.
2. Update documentation and version metadata.
3. Reload and manually verify in Chrome.
4. Commit the source, tests, and documentation together.
5. Push the branch.
