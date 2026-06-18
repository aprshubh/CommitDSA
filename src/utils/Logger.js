// @ts-check

/**
 * @fileoverview Centralized tagged logging utility supporting hierarchical logging and log levels.
 */

export class Logger {
  // Global flag to enable/disable debug-level logs
  static isDebugEnabled = false;

  /**
   * @param {string} [tag] - Optional tag prefix for this logger instance
   */
  constructor(tag = '') {
    this.tag = tag;
  }

  /**
   * Spawns a child logger with an appended tag context.
   * @param {string} subTag - Tag to append
   * @returns {Logger}
   */
  child(subTag) {
    const newTag = this.tag ? `${this.tag}][${subTag}` : subTag;
    return new Logger(newTag);
  }

  /**
   * Internal print wrapper.
   * @private
   * @param {string} level - Log level string
   * @param {any[]} args - Arguments to print
   */
  _log(level, args) {
    const prefix = `[CommitDSA]${this.tag ? `[${this.tag}]` : ''}[${level}]`;
    if (level === 'ERROR') {
      console.error(prefix, ...args);
    } else if (level === 'WARN') {
      console.warn(prefix, ...args);
    } else {
      console.log(prefix, ...args);
    }
  }

  /**
   * Prints debug logs. Muted if Logger.isDebugEnabled is false.
   * @param  {...any} args
   */
  debug(...args) {
    if (Logger.isDebugEnabled) {
      this._log('DEBUG', args);
    }
  }

  /**
   * Prints info logs.
   * @param  {...any} args
   */
  info(...args) {
    this._log('INFO', args);
  }

  /**
   * Prints warning logs.
   * @param  {...any} args
   */
  warn(...args) {
    this._log('WARN', args);
  }

  /**
   * Prints error logs.
   * @param  {...any} args
   */
  error(...args) {
    this._log('ERROR', args);
  }
}

// Global logger instance
export const log = new Logger();
