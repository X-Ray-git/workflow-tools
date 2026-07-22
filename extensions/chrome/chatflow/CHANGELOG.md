# Changelog

All notable ChatFlow changes are recorded here. ChatFlow uses semantic versioning while it remains a personal unpacked extension.

## [0.4.0] - 2026-07-22

### Added

- Fetch the matched public arXiv PDF after creating a native Chrome Split View.
- Transfer PDF bytes in base64-encoded chunks from the service worker to the exact paired ChatGPT tab.
- Attach the reconstructed `File` to ChatGPT's `#upload-files` input without entering a prompt or sending a message.
- Display lightweight fetching, success, and failure status messages on ChatGPT.
- Expire pending PDF tasks after two minutes and reject files larger than 50 MB.
- Add background transfer and ChatGPT file-input regression tests.

### Changed

- Document that Split View now prepares both ChatGPT and the source PDF attachment.

## [0.3.1] - 2026-07-22

### Fixed

- Make `Cmd/Ctrl+O` navigate directly to `https://chatgpt.com/` instead of clicking one of several duplicated sidebar links.
- Preserve custom prompts across a new-chat navigation with a short-lived local pending-prompt record.

## [0.3.0] - 2026-07-16

### Added

- Add the ChatGPT shortcut content script.
- Support new chat, prompt focus, sidebar toggle, and temporary chat shortcuts.
- Add a local custom shortcut and prompt settings panel opened with `Cmd/Ctrl+Shift+,`.
- Support `{{clipboard}}` substitution and optional new-chat behavior for custom prompts.

## [0.2.0] - 2026-07-16

### Added

- Migrate the arXiv first-visit redirect into ChatFlow.
- Store visited arXiv paper IDs locally and treat paper versions as the same paper.
- Restore the arXiv and ChatGPT host permissions used by the proven Split View implementation.

## [0.1.0] - 2026-07-16

### Added

- Establish the ChatFlow Manifest V3 extension structure.
- Migrate the original arXiv Split View to ChatGPT service worker.
- Add tests for positive, delayed, and defensive Split View scenarios.
