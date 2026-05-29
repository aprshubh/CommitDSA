# CommitDSA 🚀

Welcome to **CommitDSA**! This is a powerful, 100% serverless Chrome Extension that automatically syncs your accepted coding solutions from LeetCode and GeeksforGeeks directly to your GitHub repository.

## Features
- **Auto-Sync**: Automatically detects and pushes accepted solutions to GitHub.
- **Unified Dashboard**: Track your LeetCode Global Rank and GeeksforGeeks Score in one place.
- **Privacy First**: No backend servers. Everything runs locally in your browser sandbox using `chrome.storage.local`.

---

## 🛑 FOR CONTRIBUTORS (MUST READ)

If you want to contribute to this project, you are more than welcome! However, to maintain the high performance, security, and quality of this codebase, you **MUST** read our strict architectural rules before writing any code or opening a Pull Request.

👉 **[Read the Extension Rules Here (docs/EXTENSION_RULES.md)](docs/EXTENSION_RULES.md)** 👈

Any Pull Request that violates these rules (e.g., using `setInterval` for aggressive DOM scraping, introducing memory leaks in the background script, or adding unnecessary permissions) will be **rejected immediately**.

### How to run the extension locally for development:
1. Fork this repository and clone it to your PC.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right corner).
4. Click **Load unpacked** and select the `src/` folder from the cloned repository.
5. Make your code changes in the `src/` folder and click the "Reload" icon on the extension card to see them live.

### Submitting Changes
- Create a new branch for your feature (`git checkout -b feature-name`).
- Make sure your code adheres strictly to the `EXTENSION_RULES.md`.
- Commit your changes and open a Pull Request against the `main` branch.
- The project maintainer will review your code for security and performance before merging.

Happy Coding! 💻
