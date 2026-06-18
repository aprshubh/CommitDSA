# CommitDSA Project

## Overview

CommitDSA is a Chrome Manifest V3 extension for developers who want their accepted DSA solutions backed up automatically to GitHub without sending code or credentials through a third-party backend.

The extension currently supports:

- LeetCode
- GeeksforGeeks
- GitHub repository sync through the GitHub Contents API

## Goals

- Keep user code and credentials local-first.
- Sync accepted submissions with minimal user friction.
- Recover from offline or failed sync attempts.
- Keep the codebase small, direct, and easy to audit.
- Avoid backend infrastructure, telemetry, hidden routing, and unnecessary dependencies.

## Non-Goals

- No hosted backend service.
- No analytics or user tracking.
- No password collection for coding platforms.
- No platform-wide scraping through background DOM parsing.
- No TypeScript migration or bundling requirement for the extension runtime.

## Runtime Flow

1. `src/background/service_worker.js` starts the background app.
2. `src/background/App.js` registers Chrome listeners, content scripts, alarms, and migrations.
3. Platform `inject.js` files run in the web page context and detect accepted submissions from network responses.
4. `src/content/content.js` receives accepted solve events and forwards validated payloads to the background worker.
5. `src/services/QueueService.js` stores pending sync work and processes it sequentially.
6. `src/services/SyncService.js` pushes formatted files to GitHub.
7. `src/services/StorageService.js` serializes local storage updates.

## Source Layout

```text
src/
|-- assets/icons/       Extension icons.
|-- background/         Service worker entry and app coordinator.
|-- content/            Isolated-world content script and modal styles.
|-- models/             JSDoc typedefs.
|-- platforms/          Platform-specific injectors and stats fetchers.
|-- services/           Storage, queue, and GitHub sync services.
|-- ui/                 Popup and welcome screens.
|-- utils/              Pure helpers, constants, errors, and logging.
`-- manifest.json       Chrome extension manifest.
```

## Testing

Unit tests live in `tests/` and are run with Vitest:

```bash
npm test
```

Tests focus on pure logic and service behavior such as path generation, source formatting, storage updates, queue transitions, and sync error handling.

## Documentation Map

- `README.md` is the public-facing quick overview.
- `PROJECT.md` is the maintainer-focused project summary.
- `privacy.html` contains the public privacy policy.
- `LICENSE` contains the MIT license text.

## Release Checklist

- Run `npm test`.
- Load `src/` as an unpacked extension in Chrome.
- Verify LeetCode accepted submission detection.
- Verify GeeksforGeeks accepted submission detection.
- Verify manual and automatic sync modes.
- Verify GitHub token, repo, and branch settings.
- Review `privacy.html` before publishing.
