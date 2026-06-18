# CommitDSA

CommitDSA is a privacy-first Chrome extension that syncs accepted LeetCode and GeeksforGeeks solutions directly from your browser to your GitHub repository.

It has no backend server, no telemetry, and no account system. Your GitHub token, repo settings, solved problem queue, and platform preferences stay inside `chrome.storage.local` on your machine.

## Features

- Sync accepted LeetCode and GeeksforGeeks submissions to GitHub.
- Choose manual confirmation or automatic sync.
- Retry failed syncs through a persistent local queue.
- Keep platform stats and daily challenge data in the popup.
- Generate clean source files with problem metadata headers.
- Update the target repository README with a DSA portfolio table.
- Store all credentials locally in the browser sandbox.

## Project Structure

```text
commitdsa/
|-- scripts/
|-- src/
|   |-- assets/
|   |   `-- icons/
|   |-- background/
|   |   |-- App.js
|   |   `-- service_worker.js
|   |-- content/
|   |   |-- content.css
|   |   `-- content.js
|   |-- models/
|   |   `-- types.js
|   |-- platforms/
|   |   |-- gfg/
|   |   |   |-- inject.js
|   |   |   `-- service.js
|   |   `-- leetcode/
|   |       |-- inject.js
|   |       `-- service.js
|   |-- services/
|   |   |-- QueueService.js
|   |   |-- StorageService.js
|   |   `-- SyncService.js
|   |-- ui/
|   |   |-- popup/
|   |   `-- welcome/
|   |-- utils/
|   `-- manifest.json
|-- tests/
|-- README.md
|-- PROJECT.md
|-- LICENSE
|-- privacy.html
|-- package.json
`-- .gitignore
```

## How It Works

CommitDSA uses two browser execution contexts:

1. Platform injectors run in the page context and watch submission network responses.
2. The extension content script validates accepted submission messages and forwards them to the background service worker.
3. The background app stores the solve in a local queue.
4. The queue formats the source file and pushes it to GitHub through the GitHub Contents API.
5. Failed syncs remain in local storage and are retried safely.

## Privacy Model

CommitDSA is serverless by design.

- No backend server receives your code.
- No analytics scripts are included.
- Your GitHub Personal Access Token is stored only in `chrome.storage.local`.
- API calls go directly from your browser to GitHub, LeetCode, or GeeksforGeeks.

See [privacy.html](privacy.html) for the full privacy policy.

## Local Installation

1. Clone this repository.
2. Open Chrome and visit `chrome://extensions/`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the `src/` directory.

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

The extension code uses plain ES modules with JSDoc type hints. There is no TypeScript build step and no runtime bundler.

## Documentation

- [Project overview](PROJECT.md)
- [Privacy policy](privacy.html)

## License

CommitDSA is licensed under the MIT License. See [LICENSE](LICENSE).
