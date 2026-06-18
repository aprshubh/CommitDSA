// @ts-check

import { StorageService } from './StorageService.js';
import { SyncService } from './SyncService.js';
import { getSyncPath } from '../utils/path.js';
import { formatSourceCode, formatCommitMessage } from '../utils/sourceFormatter.js';
import { QUEUE_STATUS } from '../utils/constants.js';
import { Logger } from '../utils/Logger.js';
import { InvalidTokenError, RepoNotFoundError, NetworkError, RateLimitError } from '../utils/errors.js';

const log = Logger.prototype.child ? new Logger().child('QueueService') : new Logger('QueueService');

let isProcessing = false;

export class QueueService {
  /**
   * Enqueues a solved problem for synchronization.
   * Deterministic ID (platform-slug-language) acts as the deduplication key.
   * If a pending/failed entry exists for the same problem/language, it is updated.
   * 
   * @param {import('../models/types.js').SolvedProblem} solvedProblem
   * @returns {Promise<void>}
   */
  static async enqueue(solvedProblem) {
    const dedupeKey = solvedProblem.id;

    log.debug(`Enqueue request for: ${dedupeKey}`);

    await StorageService.update('syncQueue', (queue = []) => {
      // Find if item already exists
      const existingIdx = queue.findIndex(item => item.id === dedupeKey);

      /** @type {import('../models/types.js').QueueItem} */
      const newItem = {
        id: dedupeKey,
        status: QUEUE_STATUS.PENDING,
        retryCount: 0,
        createdAt: Date.now(),
        lastAttempt: 0,
        retryable: true,
        error: null,
        payload: solvedProblem
      };

      if (existingIdx !== -1) {
        // If existing is already completed, ignore or overwrite if the code has changed
        const existing = queue[existingIdx];
        if (existing.status === QUEUE_STATUS.COMPLETED && existing.payload.code === solvedProblem.code) {
          log.debug(`Item ${dedupeKey} is already synced with identical content. Skipping.`);
          return queue;
        }
        
        // Preserve retryCount if we are updating a failed retryable item
        if (existing.status === QUEUE_STATUS.FAILED && existing.retryable) {
          newItem.retryCount = existing.retryCount;
        }

        log.debug(`Overwriting existing queue item: ${dedupeKey} (previous status: ${existing.status})`);
        queue[existingIdx] = newItem;
      } else {
        queue.push(newItem);
      }

      return queue;
    });

    // Fire processing in the background asynchronously
    this.processQueue().catch(err => log.error('processQueue async error:', err));
  }

  /**
   * Processes all pending and retryable failed queue items sequentially.
   * Uses an execution lock to prevent parallel processing loops.
   * 
   * @returns {Promise<void>}
   */
  static async processQueue() {
    if (isProcessing) {
      log.debug('Queue processing is locked (already active).');
      return;
    }

    isProcessing = true;
    log.debug('Starting queue processing...');

    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        log.warn('Device is offline. Skipping queue processing.');
        return;
      }

      // 1. Fetch UserConfig
      const data = await StorageService.get(['githubToken', 'githubRepo', 'githubBranch', 'syncQueue']);
      const githubToken = data.githubToken;
      const githubRepo = data.githubRepo;
      const githubBranch = data.githubBranch || 'main';
      const queue = data.syncQueue || [];

      if (!githubToken || !githubRepo) {
        log.warn('GitHub is not configured. Queue processing suspended.');
        return;
      }

      // 2. Identify work items
      const itemsToProcess = queue.filter(item => 
        item.status === QUEUE_STATUS.PENDING || 
        (item.status === QUEUE_STATUS.FAILED && item.retryable)
      );

      if (itemsToProcess.length === 0) {
        log.debug('No pending or retryable items in queue.');
        return;
      }

      // Sort by creation time (FIFO)
      itemsToProcess.sort((a, b) => a.createdAt - b.createdAt);

      log.info(`Found ${itemsToProcess.length} items to sync.`);

      let anySynced = false;

      for (const item of itemsToProcess) {
        // Double check online status
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          log.warn('Network lost during queue sync. Stopping.');
          break;
        }

        // Exponential backoff check (e.g. wait 2^retryCount * 2 seconds before retrying)
        if (item.retryCount > 0) {
          const backoffDelay = Math.pow(2, item.retryCount) * 2000; // 4s, 8s, 16s, 32s
          const timeSinceLastAttempt = Date.now() - item.lastAttempt;
          if (timeSinceLastAttempt < backoffDelay) {
            log.debug(`Item ${item.id} is cooling down. Retrying in ${Math.round((backoffDelay - timeSinceLastAttempt)/1000)}s.`);
            continue;
          }
        }

        log.info(`Syncing queue item: ${item.id}`);

        // Update status to processing in storage
        await this._updateItemStatus(item.id, QUEUE_STATUS.PROCESSING);

        try {
          const solvedProblem = item.payload;
          
          // Generate file configurations
          const path = solvedProblem.customPath || getSyncPath(solvedProblem.platform, solvedProblem.difficulty, solvedProblem.title, solvedProblem.language);
          const content = formatSourceCode(solvedProblem);
          const commitMessage = formatCommitMessage(solvedProblem);

          // Invoke network caller
          await SyncService.pushToGitHub(
            { path, content, commitMessage },
            { githubToken, githubRepo, githubBranch }
          );

          // Mark completed
          await this._updateItemStatus(item.id, QUEUE_STATUS.COMPLETED);
          anySynced = true;
          log.info(`Queue item sync complete: ${item.id}`);

        } catch (err) {
          log.error(`Failed to sync queue item ${item.id}:`, err);
          
          const retryCount = item.retryCount + 1;
          const maxRetries = 5;
          let retryable = retryCount < maxRetries;
          let reasonCode = 'UNKNOWN_ERROR';
          let errorMsg = err.message || 'Unknown error';

          if (err instanceof InvalidTokenError) {
            retryable = false; // Bad token won't succeed on retry
            reasonCode = 'INVALID_TOKEN';
          } else if (err instanceof RepoNotFoundError) {
            retryable = false; // Invalid repo won't succeed on retry
            reasonCode = 'REPO_NOT_FOUND';
          } else if (err instanceof NetworkError) {
            reasonCode = 'NETWORK_ERROR';
          } else if (err instanceof RateLimitError) {
            reasonCode = 'RATE_LIMIT';
            // If RateLimitError occurs, respect the GitHub requested delay
            const delay = err.retryAfterSeconds || 60;
            log.warn(`Rate limit hit. Pausing queue sync for ${delay} seconds.`);
            
            // Mark failed but retryable, update retry count
            await this._markItemFailed(item.id, reasonCode, errorMsg, retryCount, true);
            
            // Break loop (stop processing queue immediately)
            break;
          }

          await this._markItemFailed(item.id, reasonCode, errorMsg, retryCount, retryable);

          // Break loop on network errors to avoid cascading failure delays
          if (err instanceof NetworkError) {
            break;
          }
        }
      }

      // Update README.md with portfolio if any items were synced successfully
      if (anySynced) {
        try {
          const updatedData = await StorageService.get(['syncQueue']);
          const updatedQueue = updatedData.syncQueue || [];
          const completedItems = updatedQueue.filter(item => item.status === QUEUE_STATUS.COMPLETED);
          log.info(`Sync completed. Updating README portfolio with ${completedItems.length} solved problems.`);
          await SyncService.updateReadme(completedItems, { githubToken, githubRepo, githubBranch });
        } catch (readmeErr) {
          log.error('Non-blocking README update failed:', readmeErr);
        }
      }

    } catch (e) {
      log.error('Fatal error in processQueue:', e);
    } finally {
      isProcessing = false;
      log.debug('Queue processing released.');
    }
  }

  /**
   * Safe transaction helper to update an item's status in storage.
   * 
   * @private
   * @param {string} itemId
   * @param {string} status
   */
  static async _updateItemStatus(itemId, status) {
    await StorageService.update('syncQueue', (queue = []) => {
      return queue.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            status,
            lastAttempt: status === QUEUE_STATUS.PROCESSING ? Date.now() : item.lastAttempt
          };
        }
        return item;
      });
    });
  }

  /**
   * Safe transaction helper to mark a queue item as failed with detailed metadata.
   * 
   * @private
   * @param {string} itemId
   * @param {string} reason
   * @param {string} message
   * @param {number} retryCount
   * @param {boolean} retryable
   */
  static async _markItemFailed(itemId, reason, message, retryCount, retryable) {
    await StorageService.update('syncQueue', (queue = []) => {
      return queue.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            status: QUEUE_STATUS.FAILED,
            retryCount,
            retryable,
            lastAttempt: Date.now(),
            error: { reason, message }
          };
        }
        return item;
      });
    });
  }

  /**
   * Restores any items marked as 'processing' back to 'pending' state.
   * To be invoked on background service worker boot to recover from sudden shutdowns or crashes.
   * 
   * @returns {Promise<void>}
   */
  static async restoreProcessingItems() {
    log.info('Recovering queue: resetting stuck processing states.');
    await StorageService.update('syncQueue', (queue = []) => {
      return queue.map(item => {
        if (item.status === QUEUE_STATUS.PROCESSING) {
          log.info(`Resetting stuck item: ${item.id} back to pending.`);
          return { ...item, status: QUEUE_STATUS.PENDING };
        }
        return item;
      });
    });
    // Trigger queue processing
    await this.processQueue();
  }
}
