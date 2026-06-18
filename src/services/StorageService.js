// @ts-check

/**
 * @fileoverview Safe, serialized promise-based wrapper over chrome.storage.local.
 * Guarantees race-free updates to configuration and queues using a promise serialization chain.
 */

/** @type {Promise<any>} */
let updateQueue = Promise.resolve();

export class StorageService {
  /**
   * Reads keys from chrome storage.
   * @param {string | string[] | Object | null} [keys] - Keys to retrieve.
   * @returns {Promise<Object>} Object containing the retrieved key-value pairs.
   */
  static get(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Writes key-value pairs to chrome storage.
   * @param {Object} items - Object containing key-value pairs to store.
   * @returns {Promise<void>}
   */
  static set(items) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Removes keys from chrome storage.
   * @param {string | string[]} keys - Keys to remove.
   * @returns {Promise<void>}
   */
  static remove(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Performs a serialized update on a single storage key.
   * Prevents write-after-read race conditions in concurrent asynchronous contexts.
   * Errors are absorbed per promise handler to prevent locking the queue permanently.
   * 
   * @template T
   * @param {string} key - The storage key to update.
   * @param {function(T): T | Promise<T>} updaterFn - Callback receiving current value and returning updated value.
   * @returns {Promise<T>} Resolves with the updated value.
   */
  static async update(key, updaterFn) {
    updateQueue = updateQueue
      .catch(() => {}) // absorb previous errors so the chain never dies
      .then(async () => {
        const data = await this.get(key);
        const currentVal = data[key];
        const updatedVal = await updaterFn(currentVal);
        await this.set({ [key]: updatedVal });
        return updatedVal;
      });
    return updateQueue;
  }
}
