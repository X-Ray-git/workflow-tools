# ChatFlow

ChatFlow is a personal Chrome workflow toolbox for arXiv and ChatGPT.

The existing Tampermonkey source files remain unchanged in `scripts/tampermonkey` while ChatFlow is tested.

## Current modules

- **arXiv first visit:** redirects an arXiv abstract page to its PDF on the first visit to that paper.
- **arXiv Split View:** opens ChatGPT in a newly created blank Chrome Split View pane beside an arXiv PDF.
- **ChatGPT shortcuts:** adds the core navigation shortcuts from the existing userscript.

## Requirements

- Google Chrome 140 or newer
- macOS
- Chrome native Split View

## Install for personal use

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this `extensions/chrome/chatflow` directory, which directly contains `manifest.json`.
5. Confirm that the extension card shows **ChatFlow 0.3.0**.

After changing the source, return to `chrome://extensions/` and reload ChatFlow before testing again.

After reloading the extension, refresh already-open arXiv and ChatGPT tabs so that the updated content scripts are injected.

## ChatGPT shortcuts

| Shortcut | Action |
| --- | --- |
| `Command/Ctrl + O` | Start a new chat |
| `Command/Ctrl + I` | Focus the prompt input |
| `Command/Ctrl + L` | Toggle the sidebar |
| `Command/Ctrl + Shift + N` | Toggle temporary chat |
| `Command/Ctrl + Shift + ,` | Open custom shortcut settings |

Custom shortcuts can insert a reusable prompt, optionally start a new chat first, and substitute `{{clipboard}}` with the current clipboard text. Tampermonkey settings are stored separately and must be entered again in ChatFlow.

## Test the arXiv Split View module

1. Open an arXiv PDF such as `https://arxiv.org/pdf/1706.03762`.
2. Keep the PDF as the active tab.
3. Press `Command + Option + N` to create Chrome's native Split View.
4. Confirm that the new blank pane navigates to `https://chatgpt.com/`.
5. Confirm that the original PDF pane and URL remain unchanged.

The module must not navigate in these cases:

- A normal webpage is paired with a new blank pane.
- An arXiv `/abs/` page is paired with a new blank pane.
- An existing webpage is paired with an arXiv PDF.
- A normal new tab is created outside Split View.

## Debug

1. Open `chrome://extensions/`.
2. Find ChatFlow and open its **Service Worker** inspector.
3. Repeat the complete Split View flow.
4. Inspect messages prefixed with `[chatflow:arxiv-split-view]`.

The successful path includes `[onCreated]`, `[splitView detected]`, `[matched arxiv]`, and `[update to ChatGPT]`. Skipped actions include `[skip]` and a reason.

## Automated tests

From this directory, run:

```sh
node --test tests/arxiv-split-view.test.js
```

## Current permissions

- `tabs`: reads the tabs and `splitViewId` values needed to identify the newly created Split View pane, and navigates only a qualifying blank pane to ChatGPT.
- `storage`: stores the local arXiv first-visit history.
- Access to `arxiv.org` and `chatgpt.com`: runs the two page-specific content scripts.

ChatFlow does not read page content, upload PDFs, enter prompts, or send messages.
