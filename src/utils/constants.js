// @ts-check

/**
 * @fileoverview Core enums and constants for CommitDSA.
 */

/**
 * Enums representing the processing states of sync items in the queue.
 * @readonly
 * @enum {string}
 */
export const QUEUE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Platform identifiers supported by the extension.
 * @readonly
 * @enum {string}
 */
export const PLATFORMS = {
  LEETCODE: 'leetcode',
  GFG: 'gfg'
};

/**
 * Normalized difficulty levels used in repository categorization.
 * @readonly
 * @enum {string}
 */
export const DIFFICULTY = {
  BASIC: 'Basic',
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard'
};
