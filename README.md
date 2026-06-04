# CommitDSA: Chrome Extension for LeetCode and GeeksforGeeks GitHub Synchronization

CommitDSA is a serverless, privacy-first Google Chrome Extension designed to automatically synchronize and backup accepted coding solutions from LeetCode and GeeksforGeeks (GFG) directly to a specified GitHub repository. Built under the Manifest V3 specification, CommitDSA operates entirely client-side without relying on external databases or backend servers.

---

## Key Features

- **Automated and Manual Synchronization**: Pushes solved problems immediately upon acceptance or prompts user confirmation via an in-page modal.
- **Unified Developer Dashboard**: Displays LeetCode global ranking and GeeksforGeeks overall score side-by-side inside a dark-themed popup interface.
- **Difficulty-Based Categorization (v1.2.0)**: Solutions are automatically sorted into difficulty-specific subdirectories inside the repository:
  - **LeetCode**: `LeetCode/Easy/`, `LeetCode/Medium/`, `LeetCode/Hard/`
  - **GeeksforGeeks**: `GFG/Basic/` (includes School and Basic), `GFG/Easy/`, `GFG/Medium/`, `GFG/Hard/`
- **GeeksforGeeks Difficulty Resolution**: Directly parses the exact GFG metadata to prevent false categorization, resolving the common issue where all problems are classified as Medium.
- **Privacy-Preserving Architecture**: GitHub Personal Access Tokens (PAT) and configurations are stored securely inside the browser's local sandbox (`chrome.storage.local`).
- **Clean Code Headers**: Prefixes pushed code with structured comments containing the problem link, platform name, and difficulty rating.

---

## Technical Architecture

The extension is designed around modular, object-oriented concepts to ensure high performance and maintainability:

- **Object-Oriented Platform Layer**: Uses an abstract `CodingPlatform` class subclassed into `LeetCodePlatform` and `GfgPlatform`, managed via a `PlatformFactory`. This pattern simplifies onboarding new platforms.
- **Dynamic Script Injection**: Content scripts are registered and unregistered dynamically using the `chrome.scripting` API based on user settings. If a platform is disabled, no code executes on its domains.
- **Network Interception**: Intercepts `window.fetch` and `XMLHttpRequest` in the page's main world execution context (`inject.js`) to capture the exact submitted code upon acceptance.
- **Alarm and Caching Manager**: Uses `AlarmManager` for scheduled background stat updates and caches results (1-hour TTL) to prevent rate limits.

---

## Installation

### Local Development Setup
1. Clone this repository to your local system.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** via the toggle switch in the top-right corner.
4. Click **Load unpacked** and select the `src/` directory from the cloned repository.

### Release Package Installation
1. Download the latest release ZIP package (`CommitDSA_v1.2.0.zip`) from the repository root or release page.
2. Unzip the package to a local directory.
3. Open `chrome://extensions/`, enable Developer mode, click **Load unpacked**, and select the unzipped folder.

---

## Configuration

1. Open the extension popup from the browser toolbar.
2. Click the gear icon to open **Settings**.
3. Enable the target platforms (LeetCode, GeeksforGeeks).
4. Enter your GFG handle (username) and LeetCode handle.
5. Provide your **GitHub Personal Access Token (PAT)** with `repo` scope.
6. Input your repository path in the `owner/repository` format.
7. Select your synchronization mode: **Auto** (instant push) or **Manual** (modal prompt).
8. Save settings and toggle the sync switch on the dashboard.

---

## Contribution Guidelines

We welcome contributions to CommitDSA. To maintain codebase quality and security, contributors must adhere to our extension development rules:

- Read **[Extension Rules (docs/EXTENSION_RULES.md)](docs/EXTENSION_RULES.md)** before writing code.
- No background DOM scraping; service workers must use official platform endpoints.
- Avoid using `setInterval` for DOM parsing; use event-driven interceptors.
- Keep permissions scoped to the absolute minimum necessary in `manifest.json`.
- Open a Pull Request from a dedicated feature branch (`git checkout -b feature/name`) against the `main` branch.
