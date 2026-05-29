# CommitDSA Extension Rules

This document outlines the strict logic and behavioral rules that the CommitDSA Chrome Extension MUST follow. Any future updates to the extension must adhere strictly to these guidelines.

## 1. Extension Architecture
- **No Background DOM Scraping:** The `service_worker.js` and `background` scripts must strictly rely on official platform APIs (e.g., LeetCode GraphQL, GFG Practice APIs). 
- **Isolated Environments:** The `content.js` script runs in the extension's isolated world. The `inject.js` script runs in the webpage's MAIN world to intercept `window.fetch` requests.
- **Secure Messaging:** All communication between `inject.js` and `content.js` must be validated. Never blindly trust data coming via `window.postMessage`.

## 2. Platform Specific Rules

### LeetCode
- **API Standard:** Use `https://leetcode.com/graphql/`. 
- **Authentication:** Must rely on the browser's active cookies (`credentials: 'include'`). The extension will NEVER ask for a LeetCode password.
- **User Identification:** The username must be fetched automatically using the `userStatus` GraphQL query. Do NOT enforce manual username entry for LeetCode.

### GeeksforGeeks
- **API Limitations:** GFG no longer exposes `global_rank` in its profile API. The extension MUST show "N/A (Hidden by GFG)" or the user's Score instead of a rank. Do not attempt to fake the rank.
- **Submission Detection:** Use network interception (`window.fetch` and `XMLHttpRequest`) on endpoints like `/api/v1/problems/submissions/result/` to detect successful solves. Do not use `setInterval` to read `document.body.innerText`.
- **Manual Handle:** Since GFG's current architecture makes background auto-detection unreliable, a manual Handle input in Settings is required.

## 3. GitHub Syncing
- **Commit Format:** `[Problem_Number]_[Title_In_CamelCase].[extension]`.
- **Repo URL:** The user only needs to input `owner/repo`. The extension must aggressively clean any input to strip `https://github.com/`, `.git`, or trailing slashes before attempting API pushes.
- **No Overwriting Blindly:** If a file exists, fetch its SHA hash first via the GitHub API before pushing the update to avoid 409 Conflict errors.

## 4. Performance & Best Practices
- **Rate Limiting:** Background fetches for user stats must be cached (e.g., 1 hour cache duration) to prevent IP bans from LeetCode or GFG servers.
- **No Aggressive Polling:** Never use `setInterval` to parse the DOM. Always prefer MutationObservers or Network Interceptors.
- **Minimal Permissions:** The `manifest.json` should only request what is absolutely necessary (`storage`, `alarms`, `tabs`). Host permissions must be scoped correctly.
