# CommitDSA 🚀 | Auto-Sync LeetCode & GeeksforGeeks to GitHub

**Looking for the best Chrome extension to push your LeetCode code to GitHub?** 
Welcome to **CommitDSA**! This is a powerful, 100% serverless, and privacy-first extension designed to automatically sync and back up your accepted coding solutions from LeetCode and GeeksforGeeks (GFG) directly to your GitHub repository.

---

## 🌟 Why Choose CommitDSA? (Key Features)

### 🎨 Beautiful, Clutter-Free UI (Light & Dark Mode)
Experience a premium, unified developer dashboard. Track your LeetCode Global Rank and GeeksforGeeks Score side-by-side, toggle seamlessly between **Light and Dark modes**, and manage settings without leaving your coding flow.

![CommitDSA Light Mode Dashboard](CommitDSA_Light_Screenshot.png)
![CommitDSA Dark Mode Dashboard](CommitDSA_Dark_Screenshot_3x.jpg)

### 🌐 Multi-Platform & Modular (Zero Bloatware)
CommitDSA currently supports LeetCode and GeeksforGeeks (with more platforms coming based on community demand!). 
* **Complete Control:** Only toggle on the platforms you actually use.
* **Zero Background Processes:** Disabled platforms are completely shut off. We use dynamic scripting so if a platform is off, absolutely zero background code runs on your browser, saving your RAM and CPU.

### 🧠 Smart Code Formatting & Metadata
Say goodbye to messy repositories. CommitDSA automatically:
* Detects the programming language you used and saves the file with the correct extension (e.g., `.cpp`, `.py`, `.java`).
* Injects rich metadata into the top of your code as comments, including the **Problem Link, Difficulty Level, and Platform Name**.
* Organizes files neatly into respective directories (e.g., `LeetCode/` and `GFG/`).

### 🔒 Top-Notch Security (100% Serverless)
Your data is exactly that—*yours*.
* **No Backend Servers:** There are no external databases or servers tracking your activity.
* **Local Storage:** Your GitHub Personal Access Token (PAT) and configurations are stored securely inside your browser's local sandbox (`chrome.storage.local`). All API calls are made directly from your browser to GitHub.

![CommitDSA Light Settings](CommitDSA_Settings_Light_Screenshot.png)
![CommitDSA Dark Settings](CommitDSA_Settings_Dark_Screenshot.png)

---

## 🏗️ Technical Architecture (v1.1.0 Upgrade)

This extension has been refactored to follow state-of-the-art developer guidelines under **Manifest V3** to ensure maximum efficiency:
* **Object-Oriented Platform Layer:** Uses an abstract class design (`CodingPlatform` base with `LeetCodePlatform` and `GfgPlatform` subclasses) decoupled via a `PlatformFactory`. This makes onboarding new platforms (like Codeforces, CodeChef, etc.) extremely straightforward.
* **Dynamic Script Injection (Chrome Scripting API):** No static content scripts. Content scripts are registered or unregistered dynamically based on user settings. 
* **Dynamic Alarms Management:** Background alarms and stats check polling are managed dynamically (`AlarmManager`) to reduce browser wake-ups, conserving battery life.

---

## 🛑 FOR CONTRIBUTORS (MUST READ)

If you want to contribute to this project, you are more than welcome! However, to maintain the high performance, security, and quality of this codebase, you MUST read our strict architectural rules before writing any code or opening a Pull Request.

👉 **[Read the Extension Rules Here (docs/EXTENSION_RULES.md)]** 👈

*Note: Any Pull Request that violates these rules (e.g., introducing memory leaks, using insecure remote code, or adding unnecessary permissions) will be rejected immediately.*

### 🛠️ How to run the extension locally for development:
1. Fork this repository and clone it to your PC.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right corner toggle).
4. Click **Load unpacked** and select the `src/` folder from the cloned repository.
5. Make your code changes in the `src/` folder and click the "Reload" icon on the extension card to see them live.

### 📥 Submitting Changes
1. Create a new branch for your feature (`git checkout -b feature-name`).
2. Make sure your code adheres strictly to the `docs/EXTENSION_RULES.md`.
3. Commit your changes and open a Pull Request against the `main` branch.

Happy Coding! 💻
