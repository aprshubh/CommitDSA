/**
 * @fileoverview Unified JSDoc type definitions for CommitDSA.
 * Allows type safety and auto-complete in IDEs without a build step.
 */

/**
 * @typedef {Object} SolvedProblem
 * @property {string} id - Unique deterministic ID (e.g. `leetcode-two-sum-cpp`)
 * @property {string} title - Human-readable problem title (e.g. `Two Sum`)
 * @property {string} slug - Platform-specific URL slug (e.g. `two-sum`)
 * @property {string} platform - Coding platform ID ('leetcode' | 'gfg')
 * @property {string} language - Submission programming language (e.g. `cpp`, `python3`)
 * @property {string} difficulty - Normalized difficulty level ('Easy' | 'Medium' | 'Hard' | 'Basic')
 * @property {Array<string>} topics - Associated problem tags/topics
 * @property {string} code - The accepted solution source code
 * @property {string} url - Direct link to the problem page
 * @property {number} solvedAt - Timestamp of submission acceptance
 * @property {Object} [metadata] - Flexible free-form container for metadata (e.g. runtime, memory, submissionId)
 */

/**
 * @typedef {Object} UserConfig
 * @property {string} githubToken - GitHub Personal Access Token (PAT)
 * @property {string} githubRepo - Clean target repository path (e.g. 'username/repo')
 * @property {string} [githubBranch] - Repository branch to commit to (defaults to 'main')
 * @property {Array<string>} enabledPlatforms - Enabled platforms (e.g. ['leetcode', 'gfg'])
 * @property {string} syncMode - Sync mode. Currently always 'manual'.
 * @property {number} storageVersion - Internal DB schema version (current is 2)
 */

/**
 * @typedef {Object} QueueItemError
 * @property {string} reason - Structured error slug (e.g. `INVALID_TOKEN`, `NETWORK_ERROR`)
 * @property {string} message - Descriptive error message
 */

/**
 * @typedef {Object} QueueItem
 * @property {string} id - Identifier matching the SolvedProblem.id
 * @property {string} status - Processing status ('pending' | 'processing' | 'completed' | 'failed')
 * @property {number} retryCount - Number of failed attempts
 * @property {number} createdAt - Timestamp when item was enqueued
 * @property {number} lastAttempt - Timestamp of the last attempt
 * @property {boolean} retryable - Whether the item is eligible for automatic retry
 * @property {QueueItemError|null} error - Detailed error reason if failed
 * @property {SolvedProblem} payload - The normalized solved problem details
 */

export {};
