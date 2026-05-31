# CommitDSA 🚀

Welcome to **CommitDSA**! This is a powerful, 100% serverless, and privacy-first Google Chrome Extension designed to automatically sync and backup your accepted coding solutions from LeetCode and GeeksforGeeks (GFG) directly to your GitHub repository.

---

## 🌟 Features
* **Auto & Manual Sync**: Seamlessly push accepted solutions directly to a linked GitHub repository without breaking your coding flow.
* **Unified Developer Dashboard**: Track your **LeetCode Global Rank** and **GeeksforGeeks Score** side-by-side in a modern, dark-themed popup.
* **Privacy-First (100% Serverless)**: No backend servers or databases. Your GitHub Personal Access Token (PAT) and configurations are stored securely inside your browser's local sandbox (`chrome.storage.local`).
* **Clean Code Organization**: Automatically categorizes code into organized directories (e.g. `LeetCode/` and `GFG/`) with custom file headers containing problem links, difficulties, and platform references.

---

## 🏗️ Technical Architecture (v1.1.0 Upgrade)
This extension has been refactored to follow state-of-the-art developer guidelines under **Manifest V3** to ensure maximum efficiency:

* **Object-Oriented Platform Layer**: Uses an abstract class design (`CodingPlatform` base with `LeetCodePlatform` and `GfgPlatform` subclasses) decoupled via a `PlatformFactory`. This makes onboarding new platforms (like Codeforces, CodeChef, etc.) extremely straightforward.
* **Dynamic Script Injection (Chrome Scripting API)**: No static content scripts. Content scripts are registered or unregistered dynamically using the `chrome.scripting` API based on whether the user has enabled the platform. Disabled platforms run zero code on target sites.
* **Dynamic Alarms Management**: Background alarms and stats check polling are managed dynamically (`AlarmManager`) to reduce browser wake-ups, conserving CPU and battery life.

---

## 🛑 FOR CONTRIBUTORS (MUST READ)

If you want to contribute to this project, you are more than welcome! However, to maintain the high performance, security, and quality of this codebase, you **MUST** read our strict architectural rules before writing any code or opening a Pull Request.

👉 **[Read the Extension Rules Here (docs/EXTENSION_RULES.md)](docs/EXTENSION_RULES.md)** 👈

Any Pull Request that violates these rules (e.g., introducing memory leaks, using insecure remote code, or adding unnecessary permissions) will be **rejected immediately**.

### How to run the extension locally for development:
1. Fork this repository and clone it to your PC.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right corner toggle).
4. Click **Load unpacked** and select the `src/` folder from the cloned repository.
5. Make your code changes in the `src/` folder and click the "Reload" icon on the extension card to see them live.

### Submitting Changes
* Create a new branch for your feature (`git checkout -b feature-name`).
* Make sure your code adheres strictly to the `docs/EXTENSION_RULES.md`.
* Commit your changes and open a Pull Request against the `main` branch.

Happy Coding! 💻
