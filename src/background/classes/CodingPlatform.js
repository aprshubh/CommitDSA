/**
 * @fileoverview Abstract base class representing a coding platform.
 * Enforces a standard contract for all platform subclasses (like LeetCode and GFG)
 * and provides shared local storage utility methods.
 */
export class CodingPlatform {
  constructor(name, storagePrefix) {
    if (this.constructor === CodingPlatform) {
      throw new Error("Abstract class 'CodingPlatform' cannot be instantiated directly.");
    }
    this.name = name;
    this.storagePrefix = storagePrefix;
  }

  /**
   * Fetches the active daily coding challenge (Problem of the Day).
   * @returns {Promise<Object|null>} A challenge object or null.
   */
  async fetchDailyChallenge() {
    throw new Error("Method 'fetchDailyChallenge()' must be implemented.");
  }

  /**
   * Fetches the user stats (e.g. solved counts, score, or ranking).
   * @param {string} username - User handle.
   * @returns {Promise<Object|null>} An object containing solved stats or null.
   */
  async fetchUserStats(username) {
    throw new Error("Method 'fetchUserStats()' must be implemented.");
  }

  /**
   * Generates the solve URL for a given question object.
   * @param {Object} question - The challenge details object.
   * @returns {string} The URL to solve the problem.
   */
  getSolveUrl(question) {
    throw new Error("Method 'getSolveUrl()' must be implemented.");
  }

  /**
   * Saves a key-value pair to local chrome storage with a platform-specific prefix.
   * @param {string} key - The inner storage key.
   * @param {any} value - The data to save.
   */
  async saveToLocalStorage(key, value) {
    const fullKey = `${this.storagePrefix}_${key}`;
    await chrome.storage.local.set({ [fullKey]: value });
  }

  /**
   * Retrieves a value from local chrome storage using the platform-specific prefix.
   * @param {string} key - The inner storage key.
   * @param {any} defaultValue - Default fallback value if key does not exist.
   * @returns {Promise<any>} Resolves with the retrieved value or defaultValue.
   */
  async getFromLocalStorage(key, defaultValue = null) {
    const fullKey = `${this.storagePrefix}_${key}`;
    const result = await chrome.storage.local.get([fullKey]);
    return result[fullKey] !== undefined ? result[fullKey] : defaultValue;
  }
}
