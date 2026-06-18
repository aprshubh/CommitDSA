// @ts-check

/**
 * @fileoverview Custom operational error classes for CommitDSA.
 */

/**
 * Base custom operational error.
 */
class OperationalError extends Error {
  /**
   * @param {string} message
   * @param {string} reasonCode
   */
  constructor(message, reasonCode) {
    super(message);
    this.name = this.constructor.name;
    this.reasonCode = reasonCode;
    // @ts-ignore
    if (Error.captureStackTrace) {
      // @ts-ignore
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Triggered when there is a network connectivity issue.
 */
export class NetworkError extends OperationalError {
  /**
   * @param {string} message
   */
  constructor(message = 'Network connectivity is offline.') {
    super(message, 'NETWORK_ERROR');
  }
}

/**
 * Triggered when hitting platform/provider rate limits (HTTP 429).
 */
export class RateLimitError extends OperationalError {
  /**
   * @param {string} message
   * @param {number} [retryAfterSeconds]
   */
  constructor(message = 'Rate limit exceeded.', retryAfterSeconds = 60) {
    super(message, 'RATE_LIMIT');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Triggered when the GitHub PAT is invalid or expired (HTTP 401/403).
 */
export class InvalidTokenError extends OperationalError {
  /**
   * @param {string} message
   */
  constructor(message = 'GitHub Personal Access Token is invalid or has expired.') {
    super(message, 'INVALID_TOKEN');
  }
}

/**
 * Triggered when the target GitHub repository path is invalid or cannot be found (HTTP 404).
 */
export class RepoNotFoundError extends OperationalError {
  /**
   * @param {string} message
   */
  constructor(message = 'Target repository path not found.') {
    super(message, 'REPO_NOT_FOUND');
  }
}
